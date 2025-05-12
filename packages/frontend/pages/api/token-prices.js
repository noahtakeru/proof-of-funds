/**
 * API Route: /api/token-prices
 * 
 * Proxies requests to the CoinGecko API to avoid CORS issues
 * 
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get token IDs from query parameters
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ error: 'Missing token IDs' });
    }
    
    // Construct the CoinGecko API URL
    const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    
    // Make request to CoinGecko
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`CoinGecko API returned status ${response.status}`);
    }
    
    // Parse and return the response
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying CoinGecko request:', error);
    return res.status(500).json({ error: 'Failed to fetch token prices' });
  }
}