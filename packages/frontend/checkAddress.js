const { ethers } = require('ethers');

// Check if the address matches any of our service wallets
const privateKeys = {
  amoy: '0xa034a3f20180ad21da9b4beb79b781c6aa1de1f56cfbf47e5af55c609d15b2d3',
  mainnet: '0xde0b5631bb120fbdafc1a772939e6be8c53b5fd0162e17e5241374396f11962b'
};

Object.entries(privateKeys).forEach(([network, privateKey]) => {
  const wallet = new ethers.Wallet(privateKey);
  console.log(`${network}: ${wallet.address}`);
  if (wallet.address.toLowerCase() === '0x5F4123Bc2359338194d9379306acB3E25fbc53c9'.toLowerCase()) {
    console.log(`MATCH: The address belongs to our ${network} service wallet!`);
  }
});

console.log('\nChecking if it might be a temporary wallet...');