-- Initialize database schema for testing

-- Create user roles
CREATE ROLE zkp_test_admin;
GRANT ALL PRIVILEGES ON DATABASE zkp_test TO zkp_test_admin;

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema for isolation
CREATE SCHEMA IF NOT EXISTS zkp_test;
ALTER ROLE zkp_test_user SET search_path TO zkp_test, public;

-- Create enums
CREATE TYPE zkp_test.wallet_type AS ENUM ('USER_CONNECTED', 'TEMPORARY');
CREATE TYPE zkp_test.proof_type AS ENUM ('STANDARD', 'THRESHOLD', 'MAXIMUM', 'ZERO_KNOWLEDGE');
CREATE TYPE zkp_test.proof_status AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'EXPIRED', 'REVOKED');
CREATE TYPE zkp_test.batch_status AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED');
CREATE TYPE zkp_test.org_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- Set default permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA zkp_test 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zkp_test_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA zkp_test 
GRANT USAGE, SELECT ON SEQUENCES TO zkp_test_user;