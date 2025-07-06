import { IntMaxNodeClient } from 'intmax2-server-sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked, parseEther } from 'viem';
import dotenv from 'dotenv';
import { webcrypto } from 'crypto';
import NameStone, { NameData, TextRecords } from "@namestone/namestone-sdk";

// Polyfill crypto for Node.js
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = webcrypto as any;
}

dotenv.config();

// Initialize Namestone SDK
const apiKey = process.env.NAMESTONE_API_KEY;
if (!apiKey) {
    throw new Error('NAMESTONE_API_KEY environment variable is required');
}
const ns = new NameStone(apiKey);
const mainDomain = "stealthmax.eth";

// Interface for INTMAX operations
export interface IntMaxDeposit {
    success: boolean;
    txHash?: string;
    intMaxAddress?: string;
    amount?: string;
    error?: string;
}

// Function to derive private key from parameter (same as in index.ts)
function derivePrivateKeyFromParameter(parameter: string): `0x${string}` {
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
    return derivedKey;
}

// Function to get INTMAX address from derived key
export function getDerivedAddress(parameter: string): string {
    const derivedKey = derivePrivateKeyFromParameter(parameter);
    const account = privateKeyToAccount(derivedKey);
    return account.address;
}

// Function to derive address from parameter + nonce
function deriveAddressFromParameterAndNonce(parameter: string, nonce: number): string {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('PRIVATE_KEY environment variable is required');
    }

    // Ensure private key has 0x prefix
    const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    // Create a deterministic derived key by hashing the original key with the parameter AND nonce
    const derivationData = encodePacked(
        ['bytes32', 'string', 'uint256'],
        [formattedPrivateKey as `0x${string}`, parameter, BigInt(nonce)]
    );

    const derivedKey = keccak256(derivationData);

    // Create account from derived key and return its address
    const account = privateKeyToAccount(derivedKey);
    return account.address;
}

// Function to update subdomain after successful deposit
export async function updateSubdomainAfterDeposit(subdomainName: string): Promise<void> {
    try {
        console.log(`\n🔄 UPDATING SUBDOMAIN AFTER DEPOSIT: ${subdomainName}.${mainDomain}`);

        // Get current subdomain data
        const response: NameData[] = await ns.getNames({ domain: mainDomain });
        const currentData = response.find(n => n.name === subdomainName);

        if (!currentData) {
            throw new Error(`Subdomain ${subdomainName} not found`);
        }

        // Parse current description to get nonce
        let currentNonce = 0;
        let intmaxAddress = '';

        if (currentData.text_records?.description) {
            try {
                const descriptionData = JSON.parse(currentData.text_records.description);
                currentNonce = descriptionData.nonce || 0;
                intmaxAddress = descriptionData.intmax_address || '';
            } catch (jsonError) {
                // Legacy format - treat as intmax_address with nonce 0
                intmaxAddress = currentData.text_records.description;
                currentNonce = 0;
            }
        }

        console.log(`🔢 Current nonce: ${currentNonce}`);
        console.log(`🌐 Current INTMAX address: ${intmaxAddress}`);

        // Derive new address using subdomain + current nonce
        const newDerivedAddress = deriveAddressFromParameterAndNonce(subdomainName, currentNonce);
        console.log(`🔑 New derived address: ${newDerivedAddress}`);

        // Increment nonce for next time
        const newNonce = currentNonce + 1;
        console.log(`🔢 New nonce: ${newNonce}`);

        // Create updated description with incremented nonce
        const updatedDescriptionData = {
            intmax_address: intmaxAddress,
            nonce: newNonce
        };

        const textRecords: TextRecords = {
            "com.twitter": "substream",
            "com.github": "substream",
            "url": "https://www.substream.xyz",
            "description": JSON.stringify(updatedDescriptionData),
            "avatar": "https://imagedelivery.net/UJ5oN2ajUBrk2SVxlns2Aw/e52988ee-9840-48a2-d8d9-8a92594ab200/public"
        };

        // Update the subdomain to resolve to the new address
        console.log(`📤 Updating subdomain to resolve to new address...`);
        const updateResponse = await ns.setName({
            name: subdomainName,
            domain: mainDomain,
            address: newDerivedAddress,
            text_records: textRecords
        });

        console.log(`✅ Subdomain updated successfully!`);
        console.log(`📋 Updated subdomain details:`);
        console.log(`   📛 Name: ${subdomainName}.${mainDomain}`);
        console.log(`   📍 Ethereum Address: ${newDerivedAddress}`);
        console.log(`   🌐 INTMAX Address: ${intmaxAddress}`);
        console.log(`   🔢 Nonce: ${newNonce}`);
        console.log(`   🔗 Etherscan: https://sepolia.etherscan.io/address/${newDerivedAddress}`);

    } catch (error) {
        console.error(`❌ Error updating subdomain after deposit:`, error);
        throw error;
    }
}

// Function to create INTMAX client with derived private key
async function createIntMaxClient(parameter: string): Promise<IntMaxNodeClient> {
    const derivedPrivateKey = derivePrivateKeyFromParameter(parameter);

    const client = new IntMaxNodeClient({
        environment: 'testnet',
        eth_private_key: derivedPrivateKey,
        l1_rpc_url: 'https://sepolia.gateway.tenderly.co',
    });

    return client;
}

// Function to login to INTMAX and get address
export async function loginToIntMax(parameter: string): Promise<{ address: string; client: IntMaxNodeClient }> {
    try {
        console.log(`\n🔑 ===== DERIVING KEY FOR "${parameter}" =====`);
        console.log(`🌐 Creating INTMAX client for parameter: ${parameter}`);

        // Show the key derivation process
        const derivedPrivateKey = derivePrivateKeyFromParameter(parameter);
        console.log(`✅ Derived new private key from "${parameter}": ${derivedPrivateKey.substring(0, 10)}...`);

        // Show the derived Ethereum address
        const derivedEthAddress = getDerivedAddress(parameter);
        console.log(`🔗 Derived Ethereum address: ${derivedEthAddress}`);

        const client = new IntMaxNodeClient({
            environment: 'testnet',
            eth_private_key: derivedPrivateKey,
            l1_rpc_url: 'https://sepolia.gateway.tenderly.co',
        });

        console.log(`🔐 Logging into INTMAX with derived key...`);
        await client.login();

        const intMaxAddress = client.address;
        console.log(`✅ INTMAX login successful with derived key!`);
        console.log(`🎯 Derived INTMAX address: ${intMaxAddress}`);
        console.log(`🔑 ========================================\n`);

        return { address: intMaxAddress, client };
    } catch (error) {
        console.error('❌ INTMAX login failed:', error);
        throw error;
    }
}

// Function to create master INTMAX client
async function createMasterIntMaxClient(): Promise<IntMaxNodeClient> {
    const masterPrivateKey = process.env.PRIVATE_KEY;
    if (!masterPrivateKey) {
        throw new Error('PRIVATE_KEY environment variable is required');
    }

    const formattedPrivateKey = masterPrivateKey.startsWith('0x') ? masterPrivateKey : `0x${masterPrivateKey}`;

    const client = new IntMaxNodeClient({
        environment: 'testnet',
        eth_private_key: formattedPrivateKey as `0x${string}`,
        l1_rpc_url: 'https://sepolia.gateway.tenderly.co',
    });

    return client;
}

// Function to handle ETH received event with new flow
export async function handleEthReceived(
    parameter: string,
    ethAmount: string,
    targetIntMaxAddress: string
): Promise<IntMaxDeposit> {
    try {
        console.log(`\n🔥 STARTING ETH RECEIVED FLOW for ${parameter}: ${ethAmount} ETH`);
        console.log(`🎯 Target User INTMAX Address: ${targetIntMaxAddress}`);

        // STEP 1: Initialize master client and get master INTMAX address
        console.log('\n📋 STEP 1: Initialize master client...');
        const masterClient = await createMasterIntMaxClient();
        await masterClient.login();
        const masterIntMaxAddress = masterClient.address;
        console.log(`\n🔑 ===== MASTER INTMAX ADDRESS =====`);
        console.log(`🔍 INTMAX ADDRESS FOR MASTER KEY :   ${masterIntMaxAddress}`);
        console.log(`🔑 =====================================\n`);

        // STEP 2: Check master balance and optionally transfer INTMAX tokens to user
        console.log('\n📋 STEP 2: Check master balance and transfer to user...');
        const tokens = await masterClient.getTokensList();
        const ethToken = tokens.find(
            (t: any) => t.contractAddress.toLowerCase() === '0x0000000000000000000000000000000000000000'
        );

        if (!ethToken) {
            throw new Error('ETH token not found in INTMAX token list');
        }

        const ethAmountFloat = parseFloat(ethAmount);

        // Check master balance first
        console.log(`🔍 Fetching balances for master address: ${masterIntMaxAddress}`);
        const { balances } = await masterClient.fetchTokenBalances();
        console.log(`📊 All balances:`, balances);

        const ethBalance = balances.find((b: any) => b.token.tokenIndex === ethToken.tokenIndex);
        const masterEthBalance = ethBalance ? Number(ethBalance.amount) / Math.pow(10, ethToken.decimals || 18) : 0;

        console.log(`💰 Master INTMAX ETH balance: ${masterEthBalance} ETH`);
        console.log(`🔢 Raw ETH balance:`, ethBalance?.amount.toString() || 'Not found');

        // Also check deposit history
        console.log(`📝 Checking recent deposits...`);
        try {
            const deposits = await masterClient.fetchDeposits({});
            console.log(`📦 Recent deposits:`, deposits.slice(0, 3));

            // Check deposit statuses
            console.log(`\n📊 DEPOSIT STATUS ANALYSIS:`);
            deposits.slice(0, 3).forEach((deposit: any, index: number) => {
                const statusMap: { [key: number]: string } = {
                    0: 'ReadyToClaim',
                    1: 'Processing',
                    2: 'Completed',
                    3: 'Rejected',
                    4: 'NeedToClaim'
                };
                const ethAmount = Number(deposit.amount) / 1e18;
                console.log(`   ${index + 1}. ${ethAmount} ETH - Status: ${deposit.status} (${statusMap[deposit.status] || 'Unknown'})`);
                if (deposit.status === 1) {
                    console.log(`      ⏳ This deposit is still processing and not available in balance yet`);
                } else if (deposit.status === 2) {
                    console.log(`      ✅ This deposit is completed and should be in balance`);
                }
            });

            // Calculate total completed deposits
            const completedDeposits = deposits.filter((d: any) => d.status === 2);
            const totalCompleted = completedDeposits.reduce((sum: number, d: any) => sum + Number(d.amount), 0) / 1e18;
            console.log(`   💰 Total completed deposits: ${totalCompleted} ETH`);
            console.log(`   ⏳ Pending deposits: ${deposits.filter((d: any) => d.status === 1).length}`);

        } catch (error) {
            console.log(`❌ Error fetching deposits:`, error);
        }

        if (masterEthBalance >= ethAmountFloat) {
            // Transfer 80% from master to user's INTMAX address (keep 20% for gas fees)



            try {
                // Get transfer fee
                const transferFee = await masterClient.getTransferFee();
                console.log('💰 Transfer Fee Token Index:', transferFee?.fee?.token_index);
                console.log('💰 Transfer Fee Amount:', transferFee?.fee?.amount);

                // Prepare transfer within INTMAX
                const transfers = [
                    {
                        amount: ethAmount,
                        token: ethToken,
                        address: targetIntMaxAddress
                    }
                ];

                // Execute the transfer within INTMAX


                const transferResult = await masterClient.broadcastTransaction(transfers);
                console.log(`✅ INTMAX transfer successful:`, transferResult);

                // Check transfer status and pending transactions
                try {
                    console.log(`🔍 Checking transfer status...`);
                    const transfers = await masterClient.fetchTransfers({});
                    console.log(`📋 Recent transfers:`, transfers.slice(0, 3));

                    const pendingTransfers = transfers.filter((t: any) => t.status === 'pending' || t.status === 0);
                    console.log(`⏳ Pending transfers: ${pendingTransfers.length}`);

                    if (pendingTransfers.length > 0) {
                        console.log(`📋 Pending transfers details:`, pendingTransfers);
                    }
                } catch (transferCheckError) {
                    console.error(`❌ Error checking transfer status:`, transferCheckError);
                }
            } catch (error) {
                console.error(`❌ INTMAX transfer failed:`, error);
                console.log(`⚠️ Continuing with rest of flow anyway...`);
            }
        } else {
            console.log(`⚠️ Master has insufficient INTMAX balance (${masterEthBalance} ETH), skipping transfer step`);
            console.log(`💡 User will need to deposit their own ETH to INTMAX`);
        }

        console.log(`🔄 Continuing with rest of flow regardless of transfer result...`);

        // STEP 3: Logout master client
        console.log('\n📋 STEP 3: Logout master client...');
        await masterClient.logout();
        console.log('✅ Master client logged out');

        // STEP 4: Initialize derived client with parameter's private key
        console.log(`\n📋 STEP 4: Initialize derived client for "${parameter}"...`);
        const { address: derivedIntMaxAddress, client: derivedClient } = await loginToIntMax(parameter);
        console.log(`\n🎉 ===== DERIVED CLIENT INITIALIZED =====`);
        console.log(`✅ Successfully initialized derived client for: "${parameter}"`);
        console.log(`🌐 Derived client INTMAX address: ${derivedIntMaxAddress}`);
        console.log(`🔑 Client object available: ${derivedClient ? 'YES ✅' : 'NO ❌'}`);
        console.log(`🎉 ======================================\n`);

        // STEP 5: Derived client deposits ETH to master's INTMAX address
        console.log('\n📋 STEP 5: Derived client deposits ETH to master...');
        const decimals = ethToken.decimals || 18;

        // Use precise calculation to avoid floating point precision issues
        const weiAmount = Math.round(ethAmountFloat * Math.pow(10, decimals));

        // Ensure we're working with a safe integer
        if (!Number.isSafeInteger(weiAmount)) {
            console.warn(`⚠️ WARNING: Wei amount ${weiAmount} exceeds safe integer limits`);
        }

        console.log(`🔍 DEBUG: Original amount: ${ethAmountFloat} ETH`);
        console.log(`🔍 DEBUG: Wei amount: ${weiAmount}`);
        console.log(`🔍 DEBUG: Is safe integer: ${Number.isSafeInteger(weiAmount)}`);
        console.log(`🔍 DEBUG: Token decimals: ${decimals}`);

        const depositParams = {
            amount: weiAmount,
            token: ethToken,
            address: masterIntMaxAddress,
            isMining: false,
        };

        console.log(`💰 Derived client depositing ${ethAmountFloat} ETH to master (${masterIntMaxAddress})...`);
        console.log(`🔍 DEBUG: Deposit params:`, JSON.stringify(depositParams, null, 2));

        // Execute deposit with try-catch to continue even if deposit fails
        let depositResult = null;
        let depositSuccess = false;

        try {
            depositResult = await derivedClient.deposit(depositParams);
            console.log('✅ Deposit to master successful:', depositResult);
            depositSuccess = true;

            // Check deposit status and pending transactions
            try {
                console.log(`🔍 Checking deposit status...`);
                const deposits = await derivedClient.fetchDeposits({});
                console.log(`📋 Recent deposits from derived client:`, deposits.slice(0, 3));

                const pendingDeposits = deposits.filter((d: any) => d.status === 1 || d.status === 'pending');
                console.log(`⏳ Pending deposits from derived client: ${pendingDeposits.length}`);

                if (pendingDeposits.length > 0) {
                    console.log(`📋 Pending deposits details:`, pendingDeposits);
                }
            } catch (depositCheckError) {
                console.error(`❌ Error checking deposit status:`, depositCheckError);
            }
        } catch (depositError) {
            console.error(`❌ Deposit failed (but continuing with subdomain update):`, depositError);
            console.log(`⚠️ This is expected if IntMax is down - continuing with subdomain update anyway...`);
        }

        // STEP 6: Update subdomain after successful deposit
        console.log('\n📋 STEP 6: Update subdomain after successful deposit...');
        try {
            await updateSubdomainAfterDeposit(parameter);
            console.log('✅ Subdomain updated successfully after deposit');
        } catch (subdomainUpdateError) {
            console.error(`❌ Error updating subdomain after deposit:`, subdomainUpdateError);
            // Don't throw here - we want to continue even if subdomain update fails
        }

        // STEP 7: Logout derived client
        await derivedClient.logout();
        console.log('✅ Derived client logged out');

        return {
            success: depositSuccess,
            txHash: depositResult?.txHash || 'N/A - deposit failed',
            intMaxAddress: masterIntMaxAddress,
            amount: ethAmount,
        };

    } catch (error) {
        console.error('❌ ETH received flow failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// Keep old function for manual deposits (backwards compatibility)
export async function depositToIntMax(
    parameter: string,
    ethAmount: string,
    targetIntMaxAddress: string
): Promise<IntMaxDeposit> {
    return handleEthReceived(parameter, ethAmount, targetIntMaxAddress);
}

// Function to get INTMAX balances
export async function getIntMaxBalances(parameter: string): Promise<any> {
    try {
        const { client } = await loginToIntMax(parameter);
        const { balances } = await client.fetchTokenBalances();
        return balances;
    } catch (error) {
        console.error('❌ Failed to get INTMAX balances:', error);
        throw error;
    }
}

// Function to get deposit history
export async function getDepositHistory(parameter: string): Promise<any> {
    try {
        const { client } = await loginToIntMax(parameter);
        const deposits = await client.fetchDeposits({});
        return deposits;
    } catch (error) {
        console.error('❌ Failed to get deposit history:', error);
        throw error;
    }
}

// Function to get transfer history
export async function getTransferHistory(parameter: string): Promise<any> {
    try {
        const { client } = await loginToIntMax(parameter);
        const transfers = await client.fetchTransfers({});
        return transfers;
    } catch (error) {
        console.error('❌ Failed to get transfer history:', error);
        throw error;
    }
} 