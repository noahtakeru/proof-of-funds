/**
 * Verify GCP deployment is working correctly
 */

const { verifyDeployment } = require('./gcp-deployment-utils');

// Run the verification
verifyDeployment().catch(console.error);