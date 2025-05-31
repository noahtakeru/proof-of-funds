// Deploy script for ReferenceTokenRegistry contract
const { ethers } = require("hardhat");

async function main() {
  // Get the contract factory
  const ReferenceTokenRegistry = await ethers.getContractFactory("ReferenceTokenRegistry");
  
  // Deploy the contract
  console.log("Deploying ReferenceTokenRegistry...");
  const registry = await ReferenceTokenRegistry.deploy();
  
  // Wait for deployment to complete
  await registry.deployed();
  
  console.log("ReferenceTokenRegistry deployed to:", registry.address);
  
  // Log the transaction hash
  console.log("Deployment transaction hash:", registry.deployTransaction.hash);
  
  // The contract starts paused for safety, unpause it if needed for immediate use
  console.log("Contract is initially paused for safety");
  console.log("To unpause, call unpause() function from the owner account");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });