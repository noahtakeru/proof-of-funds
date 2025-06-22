/**
 * Resend Verification Email API Endpoint
 * 
 * Proxies resend verification email requests to the backend API server.
 */

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'method_not_allowed',
      message: 'Only POST method is supported'
    });
  }

  try {
    const { email } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Get base URL for verification email
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    
    // Forward request to backend API
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
    const response = await fetch(`${backendUrl}/api/v1/user/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, baseUrl }),
    });
    
    const data = await response.json();
    
    // Return the backend response
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Resend verification proxy error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}