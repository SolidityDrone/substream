import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { keccak256, encodePacked, createPublicClient, webSocket, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import NameStone, {
    AuthenticationError,
    NetworkError,
    NameData,
    TextRecords,
} from "@namestone/namestone-sdk";
import { sepolia } from 'viem/chains';


// Load environment variables
dotenv.config();
const mainDomain = "stealthmax.eth";
// TypeScript interfaces
interface Greeting {
    message: string;
    timestamp: Date;
    server: string;
}

interface ApiResponse {
    success: boolean;
    data: any;
    timestamp: Date;
}

interface NameAddressPair {
    name: string;
    address: string;
}

// Helper function
function createGreeting(message: string): Greeting {
    return {
        message,
        timestamp: new Date(),
        server: 'TypeScript Node.js Server'
    };
}

function createApiResponse(data: any): ApiResponse {
    return {
        success: true,
        data,
        timestamp: new Date()
    };
}

// Key derivation function
function deriveKeyFromParameter(parameter: string): string {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('PRIVATE_KEY environment variable is required');
    }

    // Ensure private key has 0x prefix
    const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    // Create a deterministic derived key by hashing the original key with the parameter
    const derivationData = encodePacked(
        ['bytes32', 'string'],
        [formattedPrivateKey as `0x${string}`, parameter]
    );

    const derivedKey = keccak256(derivationData);

    // Create account from derived key and return its address
    const account = privateKeyToAccount(derivedKey);
    return account.address;
}

// Initialize Namestone SDK
const apiKey = process.env.NAMESTONE_API_KEY;
if (!apiKey) {
    throw new Error('NAMESTONE_API_KEY environment variable is required');
}
const ns = new NameStone(apiKey);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Create WebSocket client using Alchemy
const alchemyKey = process.env.ALCHEMY_KEY;
if (!alchemyKey) {
    throw new Error('ALCHEMY__KEY environment variable is required');
}

const client = createPublicClient({
    chain: sepolia,
    transport: webSocket(`wss://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`)
});

// Store monitored addresses
let monitoredAddresses: string[] = [];

// Function to update monitored addresses from your API
async function updateMonitoredAddresses() {
    try {
        const response: NameData[] = await ns.getNames({
            domain: mainDomain
        });

        monitoredAddresses = response.map(nameData => nameData.address.toLowerCase());
        console.log('📡 Updated monitored addresses:', monitoredAddresses);
        console.log(`📡 Monitoring ${monitoredAddresses.length} addresses for ETH transfers`);
    } catch (error) {
        console.error('Error updating monitored addresses:', error);
    }
}

// Function to check if a transaction is to one of our monitored addresses
function checkTransactionForMonitoredAddresses(tx: any) {
    if (!tx.to) return null;

    const toAddress = tx.to.toLowerCase();
    if (monitoredAddresses.includes(toAddress)) {
        return {
            to: tx.to,
            from: tx.from,
            value: tx.value,
            hash: tx.hash,
            blockNumber: tx.blockNumber
        };
    }
    return null;
}

// Function to find name for address
async function findNameForAddress(address: string): Promise<string | null> {
    try {
        const response: NameData[] = await ns.getNames({ domain: mainDomain });
        const nameData = response.find(n => n.address.toLowerCase() === address.toLowerCase());
        return nameData ? nameData.name : null;
    } catch (error) {
        console.error('Error finding name for address:', error);
        return null;
    }
}

// Function to log ETH received
async function logEthReceived(tx: any, ethAmount: string) {
    const name = await findNameForAddress(tx.to);
    const subdomain = name ? `${name}.${mainDomain}` : tx.to;

    console.log(`\n💰 ETH RECEIVED!`);
    console.log(`   📛 Name: ${subdomain}`);
    console.log(`   📍 To: ${tx.to}`);
    console.log(`   📤 From: ${tx.from}`);
    console.log(`   💎 Amount: ${ethAmount} ETH`);
    console.log(`   🔗 Tx Hash: ${tx.hash}`);
    console.log(`   📦 Block: ${tx.blockNumber}`);
    console.log(`   🌐 Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}\n`);
}

// Start monitoring function
async function startMonitoring() {
    console.log('🚀 Initializing ETH transfer monitoring...');

    // Update monitored addresses initially
    await updateMonitoredAddresses();

    // Update monitored addresses every 5 minutes
    setInterval(updateMonitoredAddresses, 5 * 60 * 1000);

    // Listen for new blocks
    client.watchBlocks({
        onBlock: async (block) => {
            console.log(`📦 New block: ${block.number} (${new Date().toISOString()})`);

            try {
                // Get full block with transactions
                const fullBlock = await client.getBlock({
                    blockNumber: block.number,
                    includeTransactions: true
                });

                // Check each transaction
                for (const tx of fullBlock.transactions) {
                    const matchedTx = checkTransactionForMonitoredAddresses(tx);
                    if (matchedTx && matchedTx.value > 0n) {
                        const ethAmount = formatEther(matchedTx.value);
                        await logEthReceived(matchedTx, ethAmount);
                    }
                }
            } catch (error) {
                console.error('Error processing block:', error);
            }
        },
        onError: (error) => {
            console.error('❌ Block watching error:', error);
            // Optionally restart monitoring after a delay
            setTimeout(() => {
                console.log('🔄 Restarting monitoring...');
                startMonitoring();
            }, 10000);
        }
    });

    console.log('✅ ETH transfer monitoring started successfully!');
    console.log(`🔗 Connected to: wss://eth-sepolia.g.alchemy.com/v2/${alchemyKey!.substring(0, 8)}...`);
}

// POST endpoint to register a name with intmax_address
app.post('/api/register', async (req, res) => {
    console.log('🔥 Register endpoint called!');
    console.log('📝 Request body:', req.body);

    try {
        const { subname, intmax_address } = req.body;

        // Validate required fields
        if (!subname || !intmax_address) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: subname and intmax_address are required',
                timestamp: new Date()
            });
        }

        console.log('✅ All fields provided, checking name availability...');

        // Check if name is already registered
        console.log('🔍 Checking if name exists:', subname);
        const existingNames = await ns.searchNames({
            domain: mainDomain,
            name: subname,
            exact_match: true
        });

        console.log('🔍 Search results:', existingNames);

        // If name already exists, return error
        if (existingNames && existingNames.length > 0) {
            console.log('❌ Subdomain already registered');
            return res.status(409).json({
                success: false,
                error: 'Subdomain is already registered',
                existing_name: existingNames[0],
                timestamp: new Date()
            });
        }

        console.log('✅ Name is available, deriving address and registering...');

        // Derive address from subname
        console.log('🔑 Deriving address from subname:', subname);
        const derivedAddress = deriveKeyFromParameter(subname);
        console.log('🔑 Derived address:', derivedAddress);

        const textRecords: TextRecords = {
            "com.twitter": "substream",
            "com.github": "substream",
            "url": "https://www.substream.xyz",
            "description": intmax_address,
            "avatar": "https://imagedelivery.net/UJ5oN2ajUBrk2SVxlns2Aw/e52988ee-9840-48a2-d8d9-8a92594ab200/public"
        };

        console.log('📤 Sending to Namestone SDK:', { domain: mainDomain, name: subname, address: derivedAddress, textRecords });

        const response = await ns.setName({
            name: subname,
            domain: mainDomain,
            address: derivedAddress,
            text_records: textRecords
        });

        console.log('📥 Response data:', response);

        res.json(createApiResponse({
            message: 'Registration completed successfully!',
            namestone_response: response,
            request_data: {
                domain: mainDomain,
                subname,
                intmax_address,
                derived_address: derivedAddress
            }
        }));

    } catch (error) {
        console.error('Register Error:', error);

        if (error instanceof AuthenticationError) {
            console.error("Authentication failed:", error.message);
            res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: error.message,
                timestamp: new Date()
            });
        } else if (error instanceof NetworkError) {
            console.error("Network error:", error.message);
            res.status(503).json({
                success: false,
                error: 'Network error',
                message: error.message,
                timestamp: new Date()
            });
        } else {
            console.error("An unexpected error occurred:", error);
            res.status(500).json({
                success: false,
                error: 'Failed to register',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date()
            });
        }
    }
});




// Add this endpoint before the server startup
app.post('/api/derive-address', async (req, res) => {
    try {
        const { parameter } = req.body;

        if (!parameter) {
            return res.status(400).json({
                success: false,
                error: 'Parameter is required',
                timestamp: new Date()
            });
        }

        const derivedAddress = deriveKeyFromParameter(parameter);

        res.json(createApiResponse({
            parameter,
            derived_address: derivedAddress
        }));
    } catch (error) {
        console.error('Derivation Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to derive address',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
        });
    }
});

// GET endpoint to retrieve all names for the domain
app.get('/api/names', async (req, res) => {
    console.log('🔍 Get names endpoint called!');

    try {
        console.log('📤 Fetching names for domain:', mainDomain);

        const response: NameData[] = await ns.getNames({
            domain: mainDomain
        });

        console.log('📥 Retrieved names:', response.length);

        // Extract just name and address from each entry
        const nameAddressPairs: NameAddressPair[] = response.map(nameData => ({
            name: nameData.name,
            address: nameData.address
        }));

        console.log('📋 Simplified name-address pairs:', nameAddressPairs);

        res.json(createApiResponse({
            domain: mainDomain,
            count: nameAddressPairs.length,
            names: nameAddressPairs
        }));

    } catch (error) {
        console.error('Get Names Error:', error);

        if (error instanceof AuthenticationError) {
            console.error("Authentication failed:", error.message);
            res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: error.message,
                timestamp: new Date()
            });
        } else if (error instanceof NetworkError) {
            console.error("Network error:", error.message);
            res.status(503).json({
                success: false,
                error: 'Network error',
                message: error.message,
                timestamp: new Date()
            });
        } else {
            console.error("An unexpected error occurred:", error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve names',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date()
            });
        }
    }
});

// Add endpoint to get current monitoring status
app.get('/api/monitoring-status', async (req, res) => {
    try {
        const response: NameData[] = await ns.getNames({
            domain: mainDomain
        });

        const addresses = response.map(nameData => ({
            name: nameData.name,
            address: nameData.address,
            etherscan: `https://sepolia.etherscan.io/address/${nameData.address}`
        }));

        res.json(createApiResponse({
            monitoring: true,
            network: 'sepolia',
            addresses_count: addresses.length,
            addresses: addresses,
            last_updated: new Date().toISOString()
        }));
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get monitoring status',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🐳 Running in Docker: ${process.env.DOCKER_CONTAINER ? 'Yes' : 'No'}`);
    console.log(`\n🌐 Available endpoints:`);
    console.log(`   POST http://localhost:${PORT}/api/register`);
    console.log(`   GET http://localhost:${PORT}/api/names`);
    console.log(`   GET http://localhost:${PORT}/api/monitoring-status`);
    console.log(`   POST http://localhost:${PORT}/api/derive-address`);

    // Start monitoring ETH transfers
    setTimeout(startMonitoring, 2000); // Small delay to ensure server is ready
});