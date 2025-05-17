/**
 * API endpoint for checking service wallet status
 * 
 * This endpoint is restricted to administrators and provides
 * information about the service wallet balance and status.
 */

import { checkServiceWalletBalance } from '../../../lib/walletMonitor';
import rateLimiter from '../../../lib/rateLimit';
import { withAuth } from '../../../utils/auth';
import { handleApiError } from '../../../utils/apiErrorHandler';

// Basic API key for demo purposes - in production, use a more secure authentication method
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'pof-admin-key-2025';

// Rate limiter configuration - strict limit to prevent brute force attacks
const applyRateLimit = rateLimiter(3);

// Define the handler function with admin-only access
async function handler(req, res) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(req, res);
  if (!rateLimitResult) {
    // If rate limit is exceeded, response has already been sent
    return;
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth middleware has already verified admin status
    // We can assume req.user exists and has admin role
    
    // Check service wallet balance for both networks
    const amoyStatus = await checkServiceWalletBalance('amoy');
    const mainnetStatus = await checkServiceWalletBalance('mainnet');
    
    // Return wallet status
    return res.status(200).json({
      success: true,
      wallets: {
        amoy: amoyStatus,
        mainnet: mainnetStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error, res);
  }
}

// Export the handler wrapped with authentication middleware requiring admin role
export default withAuth(handler, { requireAdmin: true });