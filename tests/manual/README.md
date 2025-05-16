# Manual Test Scripts

This directory contains manual test scripts for the token-agnostic wallet scanning implementation and other key functionality in the Proof of Funds Protocol.

## Available Tests

- **test-cross-chain.mjs** - Tests cross-chain asset organization capabilities
- **test-logger.mjs** - Tests error logging system initialization and behavior
- **test-multi-chain.mjs** - Tests scanning assets across multiple blockchains
- **test-pagination.mjs** - Verifies pagination support for retrieving large token collections
- **test-performance.mjs** - Tests performance optimizations including caching
- **test-rate-limits.mjs** - Tests rate limiting and queue management system
- **test-token-metadata.mjs** - Verifies token metadata handling and sanitization

## Running Tests

Each test can be run independently using Node.js:

```bash
node tests/manual/test-cross-chain.mjs
node tests/manual/test-logger.mjs
# etc.
```

For more detailed information about the test suite, see the `test-summary.md` file in this directory.

## Purpose

These manual tests allow developers to verify specific functionality during development. Unlike the automated tests in the parent directory, these are meant to be run manually during development or debugging to validate behavior and gather runtime statistics.