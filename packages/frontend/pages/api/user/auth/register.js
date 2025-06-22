/**
 * User Registration API Endpoint
 * 
 * Proxies registration requests to the backend API server.
 */

import { handleApiError } from '../../../../utils/apiErrorHandler';
import { discoverBackendUrl } from '../../../../lib/backend-discovery';

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'method_not_allowed',
      message: 'Only POST method is supported'
    });
  }

  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Get base URL for verification email
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    
    // Discover backend URL dynamically
    const backendUrl = await discoverBackendUrl();
    const response = await fetch(`${backendUrl}/api/v1/user/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, baseUrl }),
    });
    
    const data = await response.json();
    
    // Return the backend response
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Registration proxy error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}