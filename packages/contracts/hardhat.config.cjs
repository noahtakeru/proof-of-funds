// Basic hardhat setup with ethers v5 support
require("@nomiclabs/hardhat-ethers"); // ethers v5 plugin
require("@nomiclabs/hardhat-waffle"); // testing plugin
require("dotenv").config();

// Get Polygonscan API key from .env
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

// Try to get the private key from environment, with fallback
let accounts = [];
try {
    const envPrivateKey = process.env.PRIVATE_KEY;

    if (envPrivateKey && envPrivateKey !== "your_private_key_here") {
        // Strip the 0x prefix if it exists
        const privateKeyWithoutPrefix = envPrivateKey.startsWith("0x")
            ? envPrivateKey.substring(2)
            : envPrivateKey;

        accounts = [privateKeyWithoutPrefix];
        console.log("Using private key from environment");
    } else {
        // Use the default Hardhat account for development
        accounts = ["ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"];
        console.log("Using default Hardhat development account");
    }
} catch (error) {
    console.error("Error setting up accounts:", error.message);
    // Fall back to Hardhat's default account
    accounts = ["ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"];
    console.log("Falling back to default Hardhat development account");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        polygon_amoy: {
            url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
            accounts: accounts,
            chainId: 80002,
            gasPrice: 'auto',
        },
        polygon_mainnet: {
            url: process.env.POLYGON_MAINNET_RPC || "https://polygon-rpc.com",
            accounts: accounts,
            chainId: 137,
            gasPrice: 'auto',
        }
    },
    etherscan: {
        apiKey: {
            polygonAmoy: POLYGONSCAN_API_KEY,
            polygon: POLYGONSCAN_API_KEY
        },
        customChains: [
            {
                network: "polygonAmoy",
                chainId: 80002,
                urls: {
                    apiURL: "https://api-amoy.polygonscan.com/api",
                    browserURL: "https://amoy.polygonscan.com/"
                }
            }
        ]
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    }
};