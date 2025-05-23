// Deployment script for ProofOfFunds contract
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Deploying ProofOfFunds contract...");

    // Get the contract factory
    const ProofOfFunds = await ethers.getContractFactory("ProofOfFunds");

    // Deploy the contract
    console.log("Starting deployment transaction...");
    const proofOfFunds = await ProofOfFunds.deploy();

    // Wait for the contract to be deployed (ethers v5 syntax)
    await proofOfFunds.deployed();

    // Get contract address and transaction hash
    const contractAddress = proofOfFunds.address;
    const deployTransaction = proofOfFunds.deployTransaction;
    const txHash = deployTransaction.hash;

    console.log(`ProofOfFunds deployed to: ${contractAddress}`);
    console.log(`Transaction hash: ${txHash}`);
    console.log(`Network: ${network.name} (chainId: ${network.config.chainId})`);

    // Log verification command
    console.log("\nTo verify on Etherscan, run:");
    console.log(`npx hardhat verify --network ${network.name} ${contractAddress}`);

    // Save deployment data to file
    const deploymentDir = path.join(__dirname, "../deployments");

    if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const deploymentData = {
        contractAddress: contractAddress,
        txHash: txHash,
        network: network.name,
        chainId: network.config.chainId,
        timestamp: new Date().toISOString(),
    };

    const filePath = path.join(
        deploymentDir,
        `${network.name}-${new Date().toISOString().replace(/:/g, "-")}.json`
    );

    fs.writeFileSync(
        filePath,
        JSON.stringify(deploymentData, null, 2)
    );

    console.log(`Deployment data saved to: ${filePath}`);
}

// Handle errors
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    }); 