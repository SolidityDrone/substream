#!/bin/bash

# StealthMax Substream Docker Build Script
echo "🐳 StealthMax Substream Docker Build Script"
echo "============================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with the required environment variables."
    echo "Check README.md for details."
    exit 1
fi

# Function to display usage
usage() {
    echo "Usage: $0 [build|run|stop|logs|clean|restart]"
    echo ""
    echo "Commands:"
    echo "  build    - Build the Docker image"
    echo "  run      - Run the container (with docker-compose)"
    echo "  stop     - Stop the container"
    echo "  logs     - View container logs"
    echo "  clean    - Remove container and image"
    echo "  restart  - Restart the container"
    echo "  help     - Show this help message"
    exit 1
}

# Build the Docker image
build() {
    echo "🔨 Building Docker image..."
    docker-compose build
    echo "✅ Build completed!"
}

# Run the container
run() {
    echo "🚀 Starting StealthMax Substream..."
    docker-compose up -d
    echo "✅ Container started!"
    echo "📡 Application is running on http://localhost:3000"
    echo "🏥 Health check: http://localhost:3000/health"
}

# Stop the container
stop() {
    echo "🛑 Stopping StealthMax Substream..."
    docker-compose down
    echo "✅ Container stopped!"
}

# View logs
logs() {
    echo "📋 Viewing container logs..."
    docker-compose logs -f
}

# Clean up containers and images
clean() {
    echo "🧹 Cleaning up containers and images..."
    docker-compose down --rmi all --volumes
    echo "✅ Cleanup completed!"
}

# Restart container
restart() {
    echo "🔄 Restarting StealthMax Substream..."
    docker-compose restart
    echo "✅ Container restarted!"
}

# Main script logic
case "$1" in
    build)
        build
        ;;
    run)
        run
        ;;
    stop)
        stop
        ;;
    logs)
        logs
        ;;
    clean)
        clean
        ;;
    restart)
        restart
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        if [ -z "$1" ]; then
            echo "❌ No command specified!"
        else
            echo "❌ Unknown command: $1"
        fi
        usage
        ;;
esac 