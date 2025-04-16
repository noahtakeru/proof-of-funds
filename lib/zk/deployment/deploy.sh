#!/bin/bash
# ZK System Deployment Script
# This script handles the deployment of the ZK system using Docker Compose
# Usage: ./deploy.sh [dev|prod] [--rebuild] [--logs] [--scale-workers n]

set -e

# Default values
ENVIRONMENT="prod"
REBUILD=false
SHOW_LOGS=false
WORKER_COUNT=2
COMPOSE_FILE="docker-compose.yml"

# Directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Process command line arguments
for arg in "$@"; do
  case $arg in
    dev)
      ENVIRONMENT="dev"
      COMPOSE_FILE="docker-compose.dev.yml"
      if [ ! -f "$COMPOSE_FILE" ]; then
        COMPOSE_FILE="docker-compose.yml"
        echo "Warning: Development compose file not found, using default"
      fi
      ;;
    prod)
      ENVIRONMENT="prod"
      COMPOSE_FILE="docker-compose.yml"
      ;;
    --rebuild)
      REBUILD=true
      ;;
    --logs)
      SHOW_LOGS=true
      ;;
    --scale-workers)
      shift
      WORKER_COUNT="$1"
      ;;
    --help)
      echo "Usage: ./deploy.sh [dev|prod] [--rebuild] [--logs] [--scale-workers n]"
      echo ""
      echo "Options:"
      echo "  dev               Deploy in development mode"
      echo "  prod              Deploy in production mode (default)"
      echo "  --rebuild         Force rebuild of Docker images"
      echo "  --logs            Show logs after deployment"
      echo "  --scale-workers n Scale zk-worker service to n instances"
      echo "  --help            Show this help message"
      exit 0
      ;;
  esac
  shift
done

echo "🚀 Deploying ZK System in $ENVIRONMENT mode"

# Check for docker and docker-compose
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker to continue."
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
  echo "❌ Docker Compose is not installed. Please install Docker Compose to continue."
  exit 1
fi

# Set Docker Compose command based on environment
COMPOSE_CMD="docker-compose -f $COMPOSE_FILE"

# Pull latest images for production deployment
if [ "$ENVIRONMENT" = "prod" ]; then
  echo "📥 Pulling latest Docker images..."
  $COMPOSE_CMD pull
fi

# Build or rebuild images
if [ "$REBUILD" = true ]; then
  echo "🔨 Rebuilding Docker images..."
  $COMPOSE_CMD build --no-cache
else
  echo "🔨 Building Docker images if needed..."
  $COMPOSE_CMD build
fi

# Stop existing services
echo "🛑 Stopping any running services..."
$COMPOSE_CMD down || true

# Start services
echo "🚀 Starting services..."
$COMPOSE_CMD up -d

# Scale workers if requested
if [ "$WORKER_COUNT" != "2" ]; then
  echo "⚖️ Scaling workers to $WORKER_COUNT instances..."
  $COMPOSE_CMD up -d --scale zk-worker=$WORKER_COUNT
fi

# Check health status of services
echo "🔍 Checking service health..."
sleep 5
$COMPOSE_CMD ps

# Show logs if requested
if [ "$SHOW_LOGS" = true ]; then
  echo "📋 Showing logs (press Ctrl+C to exit)..."
  $COMPOSE_CMD logs -f
fi

echo "✅ Deployment completed successfully"

# Additional help information
echo ""
echo "Useful commands:"
echo "  $COMPOSE_CMD ps         - Check service status"
echo "  $COMPOSE_CMD logs -f    - Follow logs"
echo "  $COMPOSE_CMD down       - Stop all services"
echo "  $COMPOSE_CMD restart    - Restart all services"
echo ""
echo "API service is available at: http://localhost:3000"
echo "Admin dashboard is available at: http://localhost:3001" 