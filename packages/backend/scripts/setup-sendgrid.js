/**
 * SendGrid Setup Guide
 * 
 * This script provides instructions for setting up SendGrid
 */

console.log('📧 SendGrid Setup Instructions\n');
console.log('1. Go to: https://sendgrid.com/');
console.log('2. Sign up for a free account (100 emails/day)');
console.log('3. Verify your email address');
console.log('4. Complete sender identity verification');
console.log('5. Go to Settings → API Keys');
console.log('6. Create a new API key with "Full Access"');
console.log('7. Copy the API key (starts with "SG.")');

console.log('\n🔧 Environment Configuration:');
console.log('Add these to your .env files:\n');

console.log('Backend (.env.local):');
console.log('EMAIL_HOST=smtp.sendgrid.net');
console.log('EMAIL_PORT=587');
console.log('EMAIL_SECURE=false');
console.log('EMAIL_USER=apikey');
console.log('EMAIL_PASSWORD=your-sendgrid-api-key-here');
console.log('EMAIL_FROM=noreply@yourdomain.com');

console.log('\nProduction (.env):');
console.log('EMAIL_HOST=smtp.sendgrid.net');
console.log('EMAIL_PORT=587');
console.log('EMAIL_SECURE=false');
console.log('EMAIL_USER=apikey');
console.log('EMAIL_PASSWORD=${SENDGRID_API_KEY}');
console.log('EMAIL_FROM=${VERIFIED_SENDER_EMAIL}');

console.log('\n⚠️  Important Notes:');
console.log('- Replace "your-sendgrid-api-key-here" with actual API key');
console.log('- Use a verified sender email address');
console.log('- For production, set SENDGRID_API_KEY as environment variable');
console.log('- Keep API keys secret and never commit them to git');

console.log('\n🧪 Testing:');
console.log('After setup, test with: node scripts/test-sendgrid.js');