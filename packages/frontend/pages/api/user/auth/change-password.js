/**
 * Change Password API Endpoint
 * 
 * Proxies change password requests to the backend API server.
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
    const { currentPassword, newPassword } = req.body;
    
    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header required'
      });
    }
    
    // Forward request to backend API
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
    const response = await fetch(`${backendUrl}/api/v1/user/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    
    const data = await response.json();
    
    // Return the backend response
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Change password proxy error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}