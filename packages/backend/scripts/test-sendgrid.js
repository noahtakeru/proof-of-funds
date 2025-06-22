/**
 * Test SendGrid email configuration
 */
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testSendGrid() {
  try {
    console.log('🧪 Testing SendGrid Configuration...\n');
    
    // Check environment variables
    const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    const missing = requiredVars.filter(var => !process.env[var]);
    
    if (missing.length > 0) {
      console.log('❌ Missing environment variables:');
      missing.forEach(var => console.log(`   - ${var}`));
      console.log('\nRun: node scripts/setup-sendgrid.js for setup instructions');
      return;
    }
    
    console.log('✅ Environment variables found');
    console.log(`   Host: ${process.env.EMAIL_HOST}`);
    console.log(`   Port: ${process.env.EMAIL_PORT}`);
    console.log(`   User: ${process.env.EMAIL_USER}`);
    console.log(`   Password: ${process.env.EMAIL_PASSWORD?.substring(0, 8)}...`);
    
    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    console.log('\n🔗 Testing connection...');
    await transporter.verify();
    console.log('✅ SendGrid connection successful!');
    
    // Send test email
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    console.log(`\n📧 Sending test email to: ${testEmail}`);
    
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Proof of Funds" <noreply@proofoffunds.com>',
      to: testEmail,
      subject: 'SendGrid Test Email',
      text: 'If you receive this email, SendGrid is configured correctly!',
      html: `
        <h1>🎉 SendGrid Test Successful!</h1>
        <p>Your SendGrid configuration is working correctly.</p>
        <p>This test was sent from the Proof of Funds application.</p>
        <hr>
        <small>Test performed at: ${new Date().toISOString()}</small>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    
  } catch (error) {
    console.error('❌ SendGrid test failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('535')) {
      console.log('\n💡 Common fixes:');
      console.log('   - Check if API key is correct');
      console.log('   - Ensure sender email is verified in SendGrid');
      console.log('   - Verify account is not suspended');
    }
  }
}

testSendGrid();