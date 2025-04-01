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

To test the ZK proof functionality:

- **Run unit tests**: `npm run test:zk:unit`
- **Run workflow test**: `npm run test:zk:workflow` - This tests the entire ZK proof lifecycle from creation to verification
- **Run script tests**: `npm run test:zk`

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

## Zero-Knowledge Proof System

This project includes a comprehensive zero-knowledge proof system that enables users to prove they have sufficient funds without revealing exact balances or wallet addresses.

### Key Features

- **Private Proof Generation**: Create cryptographic proofs that verify your fund ownership without exposing sensitive information.
- **Proof Types**:
  - **Balance Proofs**: Verify you own exactly a certain amount.
  - **Threshold Proofs**: Prove you have at least a certain amount.
  - **Maximum Proofs**: Verify your balance is under a specified limit.
- **Reference ID System**: Proofs are assigned unique reference IDs for sharing.
- **Secure Access Keys**: Encrypted proofs can only be decrypted with the correct access key.
- **Time-Limited Validity**: Set expiration dates for proofs.
- **Proof Management**: View, share, and revoke your proofs.

### Architecture

The ZK proof system consists of several modules:

- **Reference ID Management**: `lib/zk/referenceId.js`
- **Proof Encryption**: `lib/zk/proofEncryption.js`
- **Proof Verification**: `lib/zk/zkProofVerifier.js`
- **UI Components**:
  - `components/VerificationForm.js`
  - `components/VerificationResult.js`
  - `components/ShareProofDialog.js`
  - `components/ProofList.js`

### Pages

- **ZK Home**: `/zk-home` - Overview and links to ZK functionality
- **Create Proof**: `/create-zk` - Generate new ZK proofs
- **Verify Proof**: `/verify-zk` - Verify proofs using reference IDs and access keys
- **Manage Proofs**: `/manage-zk` - View and manage your proofs

### Testing

The ZK proof system includes comprehensive tests:

1. **Unit Tests**: Run with `npm test`
2. **Script Tests**: Run with `npm run test:zk`

### Development

To work on the ZK proof system:

1. Clone the repository
2. Install dependencies with `npm install`
3. Run the development server with `npm run dev`
4. Navigate to the ZK home page at http://localhost:3000/zk-home

For more details, see the code documentation in the respective files.
