const hre = require("hardhat");

async function main() {
  console.log("Deploying ZKVerifier contract to Polygon Amoy testnet...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "MATIC");

  // Get the contract factory
  const ZKVerifier = await hre.ethers.getContractFactory("ZKVerifier");

  // Deploy the contract
  console.log("Deploying ZKVerifier...");
  const zkVerifier = await ZKVerifier.deploy();

  // Wait for deployment
  await zkVerifier.deployed();
  console.log("ZKVerifier deployed to:", zkVerifier.address);

  // Save deployment info
  const deployment = {
    network: "polygon-amoy",
    address: zkVerifier.address,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    transactionHash: zkVerifier.deployTransaction.hash
  };

  // Save to file
  const fs = require('fs');
  const path = require('path');
  const deploymentPath = path.join(__dirname, '../deployments/zkverifier-amoy.json');
  
  // Ensure deployments directory exists
  if (!fs.existsSync(path.dirname(deploymentPath))) {
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("Deployment info saved to:", deploymentPath);

  // Wait for confirmation
  console.log("Waiting for confirmation...");
  await zkVerifier.deployTransaction.wait(5);
  console.log("Deployment confirmed!");

  // Verify the contract on Polygonscan (optional)
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log("Verifying contract on Polygonscan...");
    try {
      await hre.run("verify:verify", {
        address: zkVerifier.address,
        constructorArguments: []
      });
      console.log("Contract verified on Polygonscan!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  return zkVerifier.address;
}

// Execute deployment
main()
  .then((address) => {
    console.log("\n✅ Deployment successful!");
    console.log("Contract address:", address);
    console.log("\nNext steps:");
    console.log("1. Update ZK_VERIFIER_ADDRESS in packages/frontend/.env with:", address);
    console.log("2. Fund the service wallet if needed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });