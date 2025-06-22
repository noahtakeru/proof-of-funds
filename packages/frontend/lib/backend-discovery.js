/**
 * Backend service discovery for API proxy endpoints
 * Tries common ports to find the running backend server
 */

const COMMON_BACKEND_PORTS = [3001, 3002, 3003, 3004, 3005];

async function discoverBackendUrl() {
  // First try environment variable if set
  if (process.env.BACKEND_URL) {
    try {
      const response = await fetch(`${process.env.BACKEND_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      if (response.ok) {
        return process.env.BACKEND_URL;
      }
    } catch (error) {
      console.warn(`Environment backend URL ${process.env.BACKEND_URL} not available, trying discovery`);
    }
  }
  
  // Try common ports
  for (const port of COMMON_BACKEND_PORTS) {
    try {
      const url = `http://127.0.0.1:${port}`;
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      
      if (response.ok) {
        console.log(`✅ Discovered backend at: ${url}`);
        return url;
      }
    } catch (error) {
      // Port not available, continue trying
    }
  }
  
  throw new Error('No backend server found. Make sure the backend is running.');
}

module.exports = { discoverBackendUrl };