const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Service Wallet Generated:');
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('\nSave this private key in your .env file as SERVICE_WALLET_PRIVATE_KEY');
console.log('Then fund this address with test MATIC from the Polygon Amoy faucet');