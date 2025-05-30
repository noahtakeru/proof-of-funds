#!/bin/bash
set -e

# Start test containers
echo "Starting test database and Redis containers..."
docker-compose -f docker-compose.test.yml up -d

# Wait for containers to be ready
echo "Waiting for database to be ready..."
until docker exec proof-of-funds-postgres-test pg_isready -U zkp_test_user -d zkp_test; do
  echo "Waiting for PostgreSQL to start..."
  sleep 2
done

echo "Waiting for Redis to be ready..."
until docker exec proof-of-funds-redis-test redis-cli ping | grep -q PONG; do
  echo "Waiting for Redis to start..."
  sleep 2
done

# Set database connection string for tests
export DATABASE_URL_TEST="postgresql://zkp_test_user:test_password@localhost:5433/zkp_test"
export REDIS_URL_TEST="redis://localhost:6380"

# Run migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Test environment is ready!"
echo "Use the following connection strings in your tests:"
echo "DATABASE_URL_TEST=$DATABASE_URL_TEST"
echo "REDIS_URL_TEST=$REDIS_URL_TEST"