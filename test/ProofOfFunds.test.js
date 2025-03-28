const assert = require('assert');
const { ethers } = require("hardhat");

describe("ProofOfFunds", function () {
    let proofOfFunds;
    let owner;
    let user1;
    let user2;

    beforeEach(async function () {
        // Deploy the contract
        const ProofOfFunds = await ethers.getContractFactory("ProofOfFunds");
        proofOfFunds = await ProofOfFunds.deploy();
        await proofOfFunds.deployed();

        // Get signers
        [owner, user1, user2] = await ethers.getSigners();
    });

    describe("Proof Hash Generation", function () {
        it("Should generate different hashes for different proof types", async function () {
            const address = user1.address;
            const amount = ethers.utils.parseEther("10");

            // Generate hashes for different proof types
            const standardHash = await proofOfFunds.generateProofHash(address, amount, 0); // STANDARD
            const thresholdHash = await proofOfFunds.generateProofHash(address, amount, 1); // THRESHOLD
            const maximumHash = await proofOfFunds.generateProofHash(address, amount, 2); // MAXIMUM

            // Verify hashes are different
            assert.notEqual(standardHash, thresholdHash);
            assert.notEqual(standardHash, maximumHash);
            assert.notEqual(thresholdHash, maximumHash);
        });
    });

    describe("Standard Proof", function () {
        it("Should verify standard proof with correct amount", async function () {
            const amount = ethers.utils.parseEther("10");

            // Current timestamp plus 1 day
            const expiryTime = Math.floor(Date.now() / 1000) + 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(user1.address, amount, 0);

            // Create and submit proof
            await proofOfFunds.connect(user1).submitProof(
                0, // STANDARD type
                proofHash,
                expiryTime,
                0, // thresholdAmount (not used for standard)
                "Test signature message",
                "0x" // Empty signature for testing
            );

            // Verify with correct amount
            const isValid = await proofOfFunds.verifyStandardProof(user1.address, amount);
            assert.ok(isValid);

            // Verify with incorrect amount
            const isInvalid = await proofOfFunds.verifyStandardProof(user1.address, ethers.utils.parseEther("5"));
            assert.ok(!isInvalid);
        });
    });

    describe("Threshold Proof", function () {
        it("Should verify threshold proof for amounts at or above the threshold", async function () {
            const thresholdAmount = ethers.utils.parseEther("10");

            // Current timestamp plus 1 day
            const expiryTime = Math.floor(Date.now() / 1000) + 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(user1.address, thresholdAmount, 1);

            // Create and submit proof
            await proofOfFunds.connect(user1).submitProof(
                1, // THRESHOLD type
                proofHash,
                expiryTime,
                thresholdAmount,
                "Test signature message",
                "0x" // Empty signature for testing
            );

            // Verify with exact threshold amount
            const isValidExact = await proofOfFunds.verifyThresholdProof(user1.address, thresholdAmount);
            assert.ok(isValidExact);

            // Verify with amount below threshold
            const isValidBelow = await proofOfFunds.verifyThresholdProof(user1.address, ethers.utils.parseEther("5"));
            assert.ok(isValidBelow);

            // Verify with amount above threshold
            const isInvalidAbove = await proofOfFunds.verifyThresholdProof(user1.address, ethers.utils.parseEther("15"));
            assert.ok(!isInvalidAbove);
        });
    });

    describe("Maximum Proof", function () {
        it("Should verify maximum proof for amounts at or below the maximum", async function () {
            const maximumAmount = ethers.utils.parseEther("10");

            // Current timestamp plus 1 day
            const expiryTime = Math.floor(Date.now() / 1000) + 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(user1.address, maximumAmount, 2);

            // Create and submit proof
            await proofOfFunds.connect(user1).submitProof(
                2, // MAXIMUM type
                proofHash,
                expiryTime,
                maximumAmount,
                "Test signature message",
                "0x" // Empty signature for testing
            );

            // Verify with exact maximum amount
            const isValidExact = await proofOfFunds.verifyMaximumProof(user1.address, maximumAmount);
            assert.ok(isValidExact);

            // Verify with amount above maximum
            const isValidAbove = await proofOfFunds.verifyMaximumProof(user1.address, ethers.utils.parseEther("15"));
            assert.ok(isValidAbove);

            // Verify with amount below maximum
            const isInvalidBelow = await proofOfFunds.verifyMaximumProof(user1.address, ethers.utils.parseEther("5"));
            assert.ok(!isInvalidBelow);
        });
    });

    describe("Expiration", function () {
        it("Should not verify expired proofs", async function () {
            const amount = ethers.utils.parseEther("10");

            // Current timestamp minus 1 day (already expired)
            const expiredTime = Math.floor(Date.now() / 1000) - 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(user1.address, amount, 0);

            // Create and submit proof with expired time
            try {
                await proofOfFunds.connect(user1).submitProof(
                    0, // STANDARD type
                    proofHash,
                    expiredTime,
                    0,
                    "Test signature message",
                    "0x" // Empty signature for testing
                );
                assert.fail("Should have thrown an error for expired time");
            } catch (error) {
                // Check that the error message includes our revert reason
                assert.ok(error.message.includes("Expiry time must be in the future"));
            }
        });
    });

    describe("Revocation", function () {
        it("Should allow users to revoke their proofs", async function () {
            const amount = ethers.utils.parseEther("10");

            // Current timestamp plus 1 day
            const expiryTime = Math.floor(Date.now() / 1000) + 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(user1.address, amount, 0);

            // Create and submit proof
            await proofOfFunds.connect(user1).submitProof(
                0, // STANDARD type
                proofHash,
                expiryTime,
                0,
                "Test signature message",
                "0x" // Empty signature for testing
            );

            // Verify proof is valid
            const isValidBefore = await proofOfFunds.verifyStandardProof(user1.address, amount);
            assert.ok(isValidBefore);

            // Revoke the proof
            await proofOfFunds.connect(user1).revokeProof("Testing revocation");

            // Verify proof is no longer valid after revocation
            const isValidAfter = await proofOfFunds.verifyStandardProof(user1.address, amount);
            assert.ok(!isValidAfter);
        });
    });
}); 