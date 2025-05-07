// Verification script for ProofOfFundsSimple contract
const { run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Default to the latest deployment or allow specifying a contract address
    let contractAddress;

    if (process.argv.length > 2) {
        contractAddress = process.argv[2];
        console.log(`Using provided contract address: ${contractAddress}`);
    } else {
        // Try to read from the deployments directory
        try {
            const deploymentDir = path.join(__dirname, "../deployments");
            const deploymentFiles = fs.readdirSync(deploymentDir)
                .filter(f => f.includes(network.name) || f.includes("deployment"))
                .sort((a, b) => fs.statSync(`${deploymentDir}/${b}`).mtime.getTime() -
                    fs.statSync(`${deploymentDir}/${a}`).mtime.getTime());

            if (deploymentFiles.length > 0) {
                const deployment = JSON.parse(fs.readFileSync(`${deploymentDir}/${deploymentFiles[0]}`, "utf8"));
                contractAddress = deployment.contractAddress;
                console.log(`Using latest deployment address: ${contractAddress}`);
            } else {
                throw new Error("No deployment file found");
            }
        } catch (error) {
            console.error("Error reading deployment files:", error.message);
            console.log("Please provide a contract address as a parameter");
            process.exit(1);
        }
    }

    // Verify the contract
    console.log(`Verifying contract on ${network.name}...`);
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: [],
        });
        console.log("Contract verified successfully!");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("Contract is already verified!");
        } else {
            console.error("Verification failed:", error);
            process.exit(1);
        }
    }
}

// Execute verification
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Verification script failed:", error);
        process.exit(1);
    }); 