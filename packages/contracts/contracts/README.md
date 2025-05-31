# Smart Contracts for Proof of Funds Platform

This directory contains the smart contracts for the Proof of Funds platform.

## Contracts

### ProofOfFunds.sol

The core contract for standard proof of funds verification, supporting:
- Standard (exact amount) proofs
- Threshold (minimum amount) proofs
- Maximum (maximum amount) proofs

### ReferenceTokenRegistry.sol

A secure, efficient contract for on-chain anchoring of reference tokens, supporting:
- Batch submission of tokens via Merkle trees for gas efficiency
- Token verification against Merkle roots
- Signing key management for token integrity
- Token and batch revocation mechanisms
- Circuit breaker pattern for emergency security measures

## Usage

### Development

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm run test

# Deploy to local Hardhat network
npm run deploy:local

# Deploy to Polygon Amoy testnet
npm run deploy:amoy
```

### Reference Token Registry

The `ReferenceTokenRegistry` contract provides secure, efficient on-chain anchoring for reference tokens. It uses Merkle trees to efficiently store and verify large numbers of tokens in a gas-efficient manner.

#### Key Features:

1. **Batch Processing**: Submit multiple tokens in a single transaction using Merkle trees
2. **Token Verification**: Verify token validity against on-chain Merkle roots
3. **Revocation**: Revoke individual tokens or entire batches
4. **Signing Key Management**: Manage and rotate signing keys for token security
5. **Circuit Breaker**: Pause functionality in case of emergencies

#### Example Usage:

```javascript
// Deploy the contract
const ReferenceTokenRegistry = await ethers.getContractFactory("ReferenceTokenRegistry");
const registry = await ReferenceTokenRegistry.deploy();
await registry.deployed();

// Unpause the contract (it starts paused for safety)
await registry.unpause();

// Register a signing key
const signingKeyHash = ethers.utils.id("signingKey1");
await registry.registerSigningKey(signingKeyHash, "Production Key 1");

// Create a batch of tokens
const tokenIds = [
  ethers.utils.id("token1"),
  ethers.utils.id("token2"),
  ethers.utils.id("token3")
];

// Create a Merkle tree
const leaves = tokenIds.map(id => ethers.utils.keccak256(id));
const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sort: true });
const root = tree.getHexRoot();

// Anchor the batch on-chain
const batchId = ethers.utils.id("batch1");
await registry.anchorBatch(batchId, root, tokenIds.length);

// Verify a token
const tokenId = tokenIds[0];
const proof = tree.getHexProof(ethers.utils.keccak256(tokenId));
const isValid = await registry.verifyToken(batchId, tokenId, proof);

// Revoke a token if needed
await registry.revokeToken(tokenId, batchId);
```

## Security

These contracts include several security features:
- Circuit breaker pattern (pausable)
- Access control for administrative functions
- Reentrancy protection
- Input validation and bounds checking
- Event emission for all state changes

## License

MIT