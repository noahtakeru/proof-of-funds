/**
 * Email Verification API Endpoint
 * 
 * Proxies email verification requests to the backend API server.
 */

import { handleApiError } from '../../../../utils/apiErrorHandler';

export default async function handler(req, res) {
  // Only accept POST and GET requests
  if (!['POST', 'GET'].includes(req.method)) {
    return res.status(405).json({ 
      error: 'method_not_allowed',
      message: 'Only GET and POST methods are supported'
    });
  }

  try {
    const token = req.query.token || req.body.token;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }
    
    // Forward request to backend API
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
    const response = await fetch(`${backendUrl}/api/v1/user/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });
    
    const data = await response.json();
    
    // Return the backend response
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Email verification proxy error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}