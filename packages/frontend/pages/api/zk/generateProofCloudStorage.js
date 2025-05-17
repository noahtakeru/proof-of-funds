/**
 * Secure proof generation endpoint using Google Cloud Storage
 * 
 * This handler uses the cloud storage strategy for ZK proof generation.
 * It provides enhanced security by retrieving zkey files from secure Google Cloud Storage.
 */

import { createZkProofHandler, zkProofApiConfig } from '../../../utils/zkProofHandler';

// Create a handler with the cloud storage strategy
const handler = createZkProofHandler({
  defaultStrategy: 'cloud',
  rateLimit: 3,
  verifyProof: true
});

// Export the handler
export default handler;

// Export config for Next.js
export const config = zkProofApiConfig;