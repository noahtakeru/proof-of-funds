/**
 * Utility to find available ports for development servers
 */
const net = require('net');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

async function findAvailablePort(startPort = 3000) {
  let port = startPort;
  while (port < 65535) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error('No available ports found');
}

module.exports = { findAvailablePort, isPortAvailable };

// Test if run directly
if (require.main === module) {
  findAvailablePort(3000).then(port => {
    console.log(`Available port: ${port}`);
  }).catch(console.error);
}