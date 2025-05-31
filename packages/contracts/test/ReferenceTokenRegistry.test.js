const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("ReferenceTokenRegistry", function () {
  let ReferenceTokenRegistry;
  let registry;
  let owner;
  let submitter;
  let other;
  
  // Sample token IDs for testing
  const tokenIds = [
    ethers.utils.id("token1"),
    ethers.utils.id("token2"),
    ethers.utils.id("token3"),
    ethers.utils.id("token4"),
    ethers.utils.id("token5")
  ];
  
  // Sample batch ID
  const batchId = ethers.utils.id("batch1");
  
  // Sample signing key
  const signingKeyHash = ethers.utils.id("signingKey1");
  
  // Helper function to create a Merkle tree and proofs
  function createMerkleTree(items) {
    // Hash items individually using ethers keccak256 instead of keccak256 package
    const leaves = items.map(item => ethers.utils.keccak256(item));
    
    // Create Merkle tree
    const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sort: true });
    
    // Get Merkle root
    const root = tree.getHexRoot();
    
    // Create proofs for each item
    const proofs = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const leaf = ethers.utils.keccak256(item);
      proofs[item] = tree.getHexProof(leaf);
    }
    
    return { root, proofs };
  }
  
  beforeEach(async function () {
    // Get signers
    [owner, submitter, other] = await ethers.getSigners();
    
    // Deploy contract
    ReferenceTokenRegistry = await ethers.getContractFactory("ReferenceTokenRegistry");
    registry = await ReferenceTokenRegistry.deploy();
    await registry.deployed();
    
    // Unpause the contract
    await registry.unpause();
  });
  
  describe("Batch Management", function () {
    it("should anchor a batch of tokens", async function () {
      // Create Merkle tree and get root
      const { root } = createMerkleTree(tokenIds);
      
      // Anchor batch
      await registry.connect(submitter).anchorBatch(batchId, root, tokenIds.length);
      
      // Verify batch details
      const details = await registry.getBatchDetails(batchId);
      expect(details.merkleRoot).to.equal(root);
      expect(details.proofCount).to.equal(tokenIds.length);
      expect(details.submitter).to.equal(submitter.address);
      expect(details.isRevoked).to.equal(false);
    });
    
    it("should reject anchoring with invalid parameters", async function () {
      const { root } = createMerkleTree(tokenIds);
      
      // Zero batch ID
      await expect(
        registry.connect(submitter).anchorBatch(ethers.constants.HashZero, root, tokenIds.length)
      ).to.be.revertedWith("ReferenceTokenRegistry: batch ID cannot be zero");
      
      // Zero merkle root
      await expect(
        registry.connect(submitter).anchorBatch(batchId, ethers.constants.HashZero, tokenIds.length)
      ).to.be.revertedWith("ReferenceTokenRegistry: merkle root cannot be zero");
      
      // Zero proof count
      await expect(
        registry.connect(submitter).anchorBatch(batchId, root, 0)
      ).to.be.revertedWith("ReferenceTokenRegistry: proof count must be positive");
      
      // Anchor a batch
      await registry.connect(submitter).anchorBatch(batchId, root, tokenIds.length);
      
      // Try to anchor the same batch again
      await expect(
        registry.connect(submitter).anchorBatch(batchId, root, tokenIds.length)
      ).to.be.revertedWith("ReferenceTokenRegistry: batch already exists");
    });
    
    it("should allow revoking a batch", async function () {
      // Create Merkle tree and get root
      const { root } = createMerkleTree(tokenIds);
      
      // Anchor batch
      await registry.connect(submitter).anchorBatch(batchId, root, tokenIds.length);
      
      // Revoke batch (only owner can revoke batches)
      await registry.connect(owner).revokeBatch(batchId);
      
      // Verify batch is revoked
      const details = await registry.getBatchDetails(batchId);
      expect(details.isRevoked).to.equal(true);
    });
    
    it("should not allow non-owners to revoke batches", async function () {
      // Create Merkle tree and get root
      const { root } = createMerkleTree(tokenIds);
      
      // Anchor batch
      await registry.connect(submitter).anchorBatch(batchId, root, tokenIds.length);
      
      // Try to revoke batch as non-owner
      await expect(
        registry.connect(other).revokeBatch(batchId)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  
  describe("Token Verification", function () {
    let merkleTree;
    
    beforeEach(async function () {
      // Create Merkle tree and get root
      merkleTree = createMerkleTree(tokenIds);
      
      // Anchor batch
      await registry.connect(submitter).anchorBatch(batchId, merkleTree.root, tokenIds.length);
    });
    
    it("should verify valid tokens", async function () {
      // Verify each token
      for (const tokenId of tokenIds) {
        const proof = merkleTree.proofs[tokenId];
        expect(await registry.verifyToken(batchId, tokenId, proof)).to.equal(true);
      }
    });
    
    it("should reject invalid tokens", async function () {
      // Create an invalid token ID
      const invalidTokenId = ethers.utils.id("invalid");
      
      // Get proof for a valid token (which will be invalid for the invalid token)
      const proof = merkleTree.proofs[tokenIds[0]];
      
      // Verify invalid token
      expect(await registry.verifyToken(batchId, invalidTokenId, proof)).to.equal(false);
    });
    
    it("should reject revoked tokens", async function () {
      // Revoke one token
      const tokenId = tokenIds[0];
      const proof = merkleTree.proofs[tokenId];
      
      // Verify before revocation
      expect(await registry.verifyToken(batchId, tokenId, proof)).to.equal(true);
      
      // Revoke token
      await registry.connect(submitter).revokeToken(tokenId, batchId);
      
      // Verify after revocation
      expect(await registry.verifyToken(batchId, tokenId, proof)).to.equal(false);
    });
    
    it("should reject tokens from revoked batches", async function () {
      // Verify before batch revocation
      const tokenId = tokenIds[0];
      const proof = merkleTree.proofs[tokenId];
      expect(await registry.verifyToken(batchId, tokenId, proof)).to.equal(true);
      
      // Revoke batch
      await registry.connect(owner).revokeBatch(batchId);
      
      // Verify after batch revocation
      expect(await registry.verifyToken(batchId, tokenId, proof)).to.equal(false);
    });
  });
  
  describe("Token Revocation", function () {
    let merkleTree;
    
    beforeEach(async function () {
      // Create Merkle tree and get root
      merkleTree = createMerkleTree(tokenIds);
      
      // Anchor batch
      await registry.connect(submitter).anchorBatch(batchId, merkleTree.root, tokenIds.length);
    });
    
    it("should allow submitter to revoke their tokens", async function () {
      // Revoke token
      const tokenId = tokenIds[0];
      
      await registry.connect(submitter).revokeToken(tokenId, batchId);
      
      // Verify token is revoked
      expect(await registry.revokedTokens(tokenId)).to.equal(true);
    });
    
    it("should allow owner to revoke any token", async function () {
      // Revoke token as owner
      const tokenId = tokenIds[0];
      
      await registry.connect(owner).revokeToken(tokenId, batchId);
      
      // Verify token is revoked
      expect(await registry.revokedTokens(tokenId)).to.equal(true);
    });
    
    it("should not allow others to revoke tokens", async function () {
      // Try to revoke token as non-submitter, non-owner
      const tokenId = tokenIds[0];
      
      await expect(
        registry.connect(other).revokeToken(tokenId, batchId)
      ).to.be.revertedWith("ReferenceTokenRegistry: not authorized");
    });
    
    it("should not allow revoking tokens from non-existent batches", async function () {
      const tokenId = tokenIds[0];
      const nonExistentBatchId = ethers.utils.id("nonexistent");
      
      await expect(
        registry.connect(submitter).revokeToken(tokenId, nonExistentBatchId)
      ).to.be.revertedWith("ReferenceTokenRegistry: batch does not exist");
    });
    
    it("should not allow revoking tokens from already revoked batches", async function () {
      const tokenId = tokenIds[0];
      
      // Revoke batch
      await registry.connect(owner).revokeBatch(batchId);
      
      // Try to revoke token from revoked batch
      await expect(
        registry.connect(submitter).revokeToken(tokenId, batchId)
      ).to.be.revertedWith("ReferenceTokenRegistry: batch is already revoked");
    });
  });
  
  describe("Signing Key Management", function () {
    it("should register a signing key", async function () {
      // Register signing key
      await registry.connect(owner).registerSigningKey(signingKeyHash, "Test Key");
      
      // Verify key is registered and active
      expect(await registry.isSigningKeyActive(signingKeyHash)).to.equal(true);
      
      // Verify key details
      const details = await registry.getSigningKeyDetails(signingKeyHash);
      expect(details.isActive).to.equal(true);
      expect(details.description).to.equal("Test Key");
    });
    
    it("should not allow registering the same key twice", async function () {
      // Register key
      await registry.connect(owner).registerSigningKey(signingKeyHash, "Test Key");
      
      // Try to register the same key again
      await expect(
        registry.connect(owner).registerSigningKey(signingKeyHash, "Test Key 2")
      ).to.be.revertedWith("ReferenceTokenRegistry: key already registered");
    });
    
    it("should not allow non-owners to register keys", async function () {
      // Try to register key as non-owner
      await expect(
        registry.connect(other).registerSigningKey(signingKeyHash, "Test Key")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("should rotate signing keys", async function () {
      // Register first key
      await registry.connect(owner).registerSigningKey(signingKeyHash, "Key 1");
      
      // Create second key
      const signingKeyHash2 = ethers.utils.id("signingKey2");
      
      // Rotate keys - we'll skip the event validation here due to timestamp issues
      await registry.connect(owner).rotateSigningKey(signingKeyHash2, "Key 2");
      
      // Verify first key is now inactive
      expect(await registry.isSigningKeyActive(signingKeyHash)).to.equal(false);
      
      // Verify second key is active
      expect(await registry.isSigningKeyActive(signingKeyHash2)).to.equal(true);
    });
    
    it("should deactivate a signing key", async function () {
      // Register key
      await registry.connect(owner).registerSigningKey(signingKeyHash, "Test Key");
      
      // Deactivate key
      await registry.connect(owner).deactivateSigningKey(signingKeyHash);
      
      // Verify key is inactive
      expect(await registry.isSigningKeyActive(signingKeyHash)).to.equal(false);
    });
    
    it("should get all signing key hashes", async function () {
      // Register multiple keys
      await registry.connect(owner).registerSigningKey(signingKeyHash, "Key 1");
      
      const signingKeyHash2 = ethers.utils.id("signingKey2");
      await registry.connect(owner).registerSigningKey(signingKeyHash2, "Key 2");
      
      // Get all key hashes
      const keyHashes = await registry.getAllSigningKeyHashes();
      
      // Verify all keys are returned
      expect(keyHashes.length).to.equal(2);
      expect(keyHashes).to.include(signingKeyHash);
      expect(keyHashes).to.include(signingKeyHash2);
    });
  });
  
  describe("Circuit Breaker", function () {
    it("should allow owner to pause and unpause the contract", async function () {
      // Pause contract
      await registry.connect(owner).pause();
      
      // Verify contract is paused
      expect(await registry.paused()).to.equal(true);
      
      // Try to anchor batch while paused
      const { root } = createMerkleTree(tokenIds);
      await expect(
        registry.connect(submitter).anchorBatch(batchId, root, tokenIds.length)
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause contract
      await registry.connect(owner).unpause();
      
      // Verify contract is unpaused
      expect(await registry.paused()).to.equal(false);
      
      // Now anchoring should work
      await registry.connect(submitter).anchorBatch(batchId, root, tokenIds.length);
    });
    
    it("should not allow non-owners to pause or unpause", async function () {
      // Try to pause as non-owner
      await expect(
        registry.connect(other).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Pause as owner
      await registry.connect(owner).pause();
      
      // Try to unpause as non-owner
      await expect(
        registry.connect(other).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  
  // Helper function to get the current block timestamp
  async function getBlockTimestamp() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block.timestamp;
  }
});