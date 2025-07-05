# TypeScript Docker Node.js Server

A simple TypeScript Node.js server with Express, containerized with Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional)

## Building the Docker Image

```bash
docker build -t typescript-hello .
```

## Running the Container

```bash
docker run -p 3000:3000 typescript-hello
```

The server will be available at `http://localhost:3000`

## Available Endpoints

- **GET /** - Welcome message with server info
- **GET /health** - Health check endpoint

## Development

### Local Development (without Docker)

1. Install dependencies:
```bash
npm install
```

2. Run in development mode:
```bash
npm run dev
```

3. Build TypeScript:
```bash
npm run build
```

4. Run the built application:
```bash
npm start
```

## Project Structure

```
.
├── src/
│   └── index.ts          # Main TypeScript file
├── Dockerfile            # Docker configuration
├── .dockerignore         # Docker ignore file
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Features

- **Express.js Server**: RESTful API with multiple endpoints
- **TypeScript**: Full TypeScript support with proper type definitions
- **Multi-stage Docker build**: Optimized production image
- **Security**: Non-root user in container
- **Lightweight**: Alpine Linux base for smaller image size
- **Health Checks**: Built-in health monitoring endpoint # substream
