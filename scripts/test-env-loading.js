/**
 * Test environment variable loading
 */

require('dotenv').config();

console.log('===== Environment Variables Test =====');
console.log(`GCP_PROJECT_ID: ${process.env.GCP_PROJECT_ID}`);
console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

// Test in ZKeyManager context
const ZKeyManager = require('../packages/backend/utils/zkeyManager');
const manager = new ZKeyManager();
console.log(`\nZKeyManager projectId: ${manager.projectId}`);

if (!process.env.GCP_PROJECT_ID) {
  console.error('\n❌ GCP_PROJECT_ID is not set!');
  console.error('Check your .env file');
} else {
  console.log('\n✅ Environment variables loaded successfully');
}