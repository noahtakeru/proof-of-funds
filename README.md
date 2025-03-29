# Proof of Funds Protocol

A decentralized protocol for verifying proof of funds ownership on EVM-compatible blockchains, with a focus on privacy and user control. This project consists of:

1. Smart contracts for on-chain verification
2. A Next.js frontend for user interaction

## Smart Contract Features

- Verifiable proofs of fund ownership with three verification modes:
  - **Standard Proof**: Verify exact amount of funds
  - **Threshold Proof**: Verify a minimum amount of funds
  - **Maximum Proof**: Verify a maximum amount of funds
- User-controlled expiration dates
- Proof revocation capabilities
- Zero-knowledge verification (in progress)

## Frontend Features

- Connect multiple wallets (Ethereum, Polygon, etc.)
- Create and manage proofs of funds
- Share proofs with third parties
- Verify proofs received from others

## Project Structure

```
proof-of-funds/
├── contracts/           # Smart contract source files
├── scripts/             # Deployment & verification scripts
├── test/                # Contract test files
├── deployments/         # Deployment artifacts and records
├── artifacts/           # Compiled contract artifacts
├── cache/               # Hardhat cache
├── components/          # React components
├── pages/               # Next.js pages
├── public/              # Static assets
├── styles/              # CSS and styling
└── config/              # Configuration files
```

## Development Setup

### Prerequisites

- Node.js 16+
- npm or yarn
- An Ethereum/Polygon wallet with testnet funds

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

### Smart Contract Development

1. Compile the contracts
   ```bash
   npm run compile
   ```

2. Run tests
   ```bash
   npm run test
   ```

3. Deploy to local network
   ```bash
   npm run deploy:local
   ```

4. Deploy to Polygon Amoy testnet
   ```bash
   npm run deploy:amoy
   ```
   
5. Verify contract on Polygonscan
   ```bash
   npm run verify:amoy
   ```

### Frontend Development

1. Start the development server
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) with your browser

## Testing

- Smart contract tests: `npm run test`
- Frontend tests: (coming soon)

## Deployment

### Contract Deployment

The contract can be deployed to any EVM-compatible network. The deployment scripts are configured for:

- Local Hardhat network
- Polygon Amoy Testnet
- Polygon Mainnet (requires configuration)

### Frontend Deployment

The Next.js frontend can be deployed to Vercel or any other hosting service:

```bash
npm run build
npm run start
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
