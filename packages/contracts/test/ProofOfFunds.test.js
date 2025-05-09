const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProofOfFunds", function () {
    let proofOfFunds;
    let owner;
    let user1;
    let user2;

    // Helper function for parsing ether that works with both ethers v5 and v6
    const parseEther = (value) => {
        if (typeof ethers.parseEther === 'function') {
            // ethers v6
            return ethers.parseEther(value);
        } else if (typeof ethers.utils?.parseEther === 'function') {
            // ethers v5
            return ethers.utils.parseEther(value);
        } else {
            throw new Error('Cannot find parseEther function in ethers');
        }
    };

    beforeEach(async function () {
        // Deploy the contract
        const ProofOfFunds = await ethers.getContractFactory("ProofOfFunds");
        proofOfFunds = await ProofOfFunds.deploy();
        await proofOfFunds.deployed(); // ethers v5 uses deployed() instead of waitForDeployment()

        // Get signers
        [owner, user1, user2] = await ethers.getSigners();
    });

    describe("Proof Hash Generation", function () {
        it("Should generate different hashes for different proof types", async function () {
            const address = await user1.getAddress();
            const amount = parseEther("10");

            // Generate hashes for different proof types
            const standardHash = await proofOfFunds.generateProofHash(address, amount, 0); // STANDARD
            const thresholdHash = await proofOfFunds.generateProofHash(address, amount, 1); // THRESHOLD
            const maximumHash = await proofOfFunds.generateProofHash(address, amount, 2); // MAXIMUM

            // Verify hashes are different
            expect(standardHash).to.not.equal(thresholdHash);
            expect(standardHash).to.not.equal(maximumHash);
            expect(thresholdHash).to.not.equal(maximumHash);
        });
    });

    describe("Standard Proof", function () {
        it("Should verify standard proof with correct amount", async function () {
            const amount = parseEther("10");
            const address = await user1.getAddress();

            // Current timestamp plus 1 day
            const expiryTime = Math.floor(Date.now() / 1000) + 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(address, amount, 0);

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
            const isValid = await proofOfFunds.verifyStandardProof(address, amount);
            expect(isValid).to.be.true;

            // Verify with incorrect amount
            const isInvalid = await proofOfFunds.verifyStandardProof(address, parseEther("5"));
            expect(isInvalid).to.be.false;
        });
    });

    describe("Threshold Proof", function () {
        it("Should verify threshold proof for amounts at or above the threshold", async function () {
            const thresholdAmount = parseEther("10");
            const address = await user1.getAddress();

            // Current timestamp plus 1 day
            const expiryTime = Math.floor(Date.now() / 1000) + 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(address, thresholdAmount, 1);

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
            const isValidExact = await proofOfFunds.verifyThresholdProof(address, thresholdAmount);
            expect(isValidExact).to.be.true;

            // Verify with amount below threshold
            const isValidBelow = await proofOfFunds.verifyThresholdProof(address, parseEther("5"));
            expect(isValidBelow).to.be.true;

            // Verify with amount above threshold
            const isInvalidAbove = await proofOfFunds.verifyThresholdProof(address, parseEther("15"));
            expect(isInvalidAbove).to.be.false;
        });
    });

    describe("Maximum Proof", function () {
        it("Should verify maximum proof for amounts at or below the maximum", async function () {
            const maximumAmount = parseEther("10");
            const address = await user1.getAddress();

            // Current timestamp plus 1 day
            const expiryTime = Math.floor(Date.now() / 1000) + 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(address, maximumAmount, 2);

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
            const isValidExact = await proofOfFunds.verifyMaximumProof(address, maximumAmount);
            expect(isValidExact).to.be.true;

            // Verify with amount above maximum
            const isValidAbove = await proofOfFunds.verifyMaximumProof(address, parseEther("15"));
            expect(isValidAbove).to.be.true;

            // Verify with amount below maximum
            const isInvalidBelow = await proofOfFunds.verifyMaximumProof(address, parseEther("5"));
            expect(isInvalidBelow).to.be.false;
        });
    });

    describe("Expiration", function () {
        it("Should not verify expired proofs", async function () {
            const amount = parseEther("10");
            const address = await user1.getAddress();

            // Current timestamp minus 1 day (already expired)
            const expiredTime = Math.floor(Date.now() / 1000) - 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(address, amount, 0);

            // Create and submit proof with expired time
            await expect(
                proofOfFunds.connect(user1).submitProof(
                    0, // STANDARD type
                    proofHash,
                    expiredTime,
                    0,
                    "Test signature message",
                    "0x" // Empty signature for testing
                )
            ).to.be.revertedWith("Expiry time must be in the future");
        });
    });

    describe("Revocation", function () {
        it("Should allow users to revoke their proofs", async function () {
            const amount = parseEther("10");
            const address = await user1.getAddress();

            // Current timestamp plus 1 day
            const expiryTime = Math.floor(Date.now() / 1000) + 86400;

            // Generate proof hash
            const proofHash = await proofOfFunds.generateProofHash(address, amount, 0);

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
            const isValidBefore = await proofOfFunds.verifyStandardProof(address, amount);
            expect(isValidBefore).to.be.true;

            // Revoke the proof
            await proofOfFunds.connect(user1).revokeProof("Testing revocation");

            // Verify proof is no longer valid after revocation
            const isValidAfter = await proofOfFunds.verifyStandardProof(address, amount);
            expect(isValidAfter).to.be.false;
        });
    });
});