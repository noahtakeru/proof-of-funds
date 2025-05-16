# Proof of Funds Protocol

A decentralized protocol for verifying proof of funds ownership on EVM-compatible blockchains, with a focus on privacy and user control. This project is structured as a monorepo with the following packages:

1. **@proof-of-funds/common** - Core utilities and zero-knowledge proof functionality
2. **@proof-of-funds/contracts** - Smart contracts for on-chain verification
3. **@proof-of-funds/frontend** - Next.js frontend for user interaction

## Features

- Verifiable proofs of fund ownership with three verification modes:
  - **Standard Proof**: Verify exact amount of funds
  - **Threshold Proof**: Verify a minimum amount of funds
  - **Maximum Proof**: Verify a maximum amount of funds
- Zero-knowledge proofs for privacy-preserving verification
- User-controlled expiration dates
- Proof revocation capabilities
- Multi-chain support (Ethereum, Polygon, etc.)
- Comprehensive wallet integration
- Token-agnostic implementation with no special handling for specific tokens

## Monorepo Structure

```
proof-of-funds/
├── packages/
│   ├── common/             # Core utilities and ZK functionality
│   ├── contracts/          # Smart contract source files
│   └── frontend/           # Next.js frontend application
└── config/                 # Root configuration files
```

## Development Setup

### Prerequisites

- Node.js 16+
- npm or yarn
- An Ethereum/Polygon wallet with testnet funds
- Circom and snarkjs for ZK circuit compilation

### Environment Setup

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/proof-of-funds.git
   cd proof-of-funds
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your private key and other required variables.

4. Set up ZK dependencies and compile circuits
   ```bash
   # Install ZK dependencies
   chmod +x scripts/setup-zk-dependencies.sh
   ./scripts/setup-zk-dependencies.sh
   
   # Compile ZK circuits
   node scripts/compile-circuits.js
   ```

### Smart Contract Development

1. Compile the contracts
   ```bash
   npm run compile
   ```

2. Run tests
   ```bash
   npm run test -w @proof-of-funds/contracts
   ```

3. Deploy to local network
   ```bash
   npm run deploy:local
   ```

4. Deploy to Polygon Amoy testnet
   ```bash
   npm run deploy:amoy
   ```

### Frontend Development

1. Start the development server
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) with your browser

## Testing

- Run all tests: `npm run test`
- Test specific package: `npm run test -w @proof-of-funds/common`

## Deployment

### Contract Deployment

The contract can be deployed to any EVM-compatible network. The deployment scripts are configured for:

- Local Hardhat network
- Polygon Amoy Testnet
- Polygon Mainnet (requires configuration)

### Frontend Deployment

The Next.js frontend can be deployed to Vercel or any other hosting service:

```bash
npm run build -w @proof-of-funds/frontend
npm run start -w @proof-of-funds/frontend
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Token-Agnostic Implementation Guidelines

When contributing to this project, please follow these guidelines:

1. **No mock or placeholder code** - We want to know where we're failing to implement real functionality
2. **No special handling for specific tokens or chains** - All tokens and chains should be treated equally
3. **Handle errors gracefully** - Expose real errors rather than hiding them behind fallbacks
4. **Maintain Zero-Knowledge integrity** - Ensure ZK proofs are cryptographically sound