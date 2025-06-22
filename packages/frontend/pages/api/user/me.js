/**
 * User Profile API Endpoint
 * 
 * Proxies user profile requests to the backend API server.
 */

import { handleApiError } from '../../../utils/apiErrorHandler';

export default async function handler(req, res) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'method_not_allowed',
      message: 'Only GET method is supported'
    });
  }

  try {
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
    const response = await fetch(`${backendUrl}/api/v1/user/me`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });
    
    const data = await response.json();
    
    // Return the backend response
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('User profile proxy error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}