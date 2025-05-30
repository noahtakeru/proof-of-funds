#!/bin/bash
set -e

# Stop and remove test containers
echo "Stopping test containers..."
docker-compose -f docker-compose.test.yml down

# Optionally remove volumes
if [ "$1" == "--clean" ]; then
  echo "Removing test volumes..."
  docker volume rm proof-of-funds_postgres-test-data
fi

echo "Test environment has been shut down."