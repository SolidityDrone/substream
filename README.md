# StealthMax Substream API

A Node.js TypeScript application for monitoring ETH transfers and managing INTMAX deposits through ENS subdomains.

## Features

- 🔍 Real-time ETH transaction monitoring
- 🌐 ENS subdomain management via Namestone
- 💰 INTMAX deposit automation
- 🔄 Automatic subdomain updates with nonce tracking
- 🐳 Docker containerization

## Docker Setup

### Prerequisites

1. Create a `.env` file with the following variables:
```bash
# Private key for Ethereum transactions (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Namestone API key for domain management
NAMESTONE_API_KEY=your_namestone_api_key_here

# Alchemy API key for Ethereum network access
ALCHEMY_KEY=your_alchemy_api_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Application settings
NODE_ENV=production
PORT=3000
```

### Running with Docker Compose (Recommended)

```bash
# Build and run the application
docker-compose up --build

# Run in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Running with Docker directly

```bash
# Build the image
docker build -t stealthmax-substream .

# Run the container
docker run -d \
  --name stealthmax-substream \
  -p 3000:3000 \
  --env-file .env \
  stealthmax-substream
```

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint for Docker
- `GET /` - Basic info endpoint

### Registration
- `POST /api/register` - Register a new subdomain with INTMAX address

### Monitoring
- `GET /api/names` - Get all registered names
- `GET /api/monitoring-status` - Get monitoring status
- `GET /api/monitoring-details` - Get detailed monitoring info

### INTMAX Operations
- `POST /api/intmax/deposit` - Deposit ETH to INTMAX
- `GET /api/intmax/balances/:parameter` - Get INTMAX balances
- `GET /api/intmax/deposits/:parameter` - Get deposit history
- `GET /api/intmax/transfers/:parameter` - Get transfer history

## Docker Features

- ✅ Multi-stage build for optimized image size
- ✅ Health checks for container monitoring
- ✅ Non-root user for security
- ✅ Production-ready configuration
- ✅ Automatic restart on failure

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Ethereum private key (without 0x) | Yes |
| `NAMESTONE_API_KEY` | Namestone API key | Yes |
| `ALCHEMY_KEY` | Alchemy API key | Yes |
| `ALCHEMY_API_KEY` | Alchemy API key (alternative) | Yes |
| `NODE_ENV` | Node environment (development/production) | No |
| `PORT` | Application port | No |

## Docker Health Check

The application includes a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "service": "stealthmax-substream",
  "version": "1.0.0"
}
```

## License

MIT