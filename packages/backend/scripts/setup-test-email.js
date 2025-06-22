/**
 * Script to set up test email credentials using Ethereal Email
 */
const nodemailer = require('nodemailer');

async function setupTestEmail() {
  try {
    console.log('🔧 Setting up test email credentials...\n');
    
    // Create test account
    const testAccount = await nodemailer.createTestAccount();
    
    console.log('✅ Test email account created:');
    console.log(`   Email: ${testAccount.user}`);
    console.log(`   Password: ${testAccount.pass}`);
    console.log(`   SMTP: ${testAccount.smtp.host}:${testAccount.smtp.port}`);
    console.log(`   Preview URL: https://ethereal.email`);
    
    console.log('\n📝 Add these to your .env.local file:');
    console.log(`EMAIL_TEST_USER="${testAccount.user}"`);
    console.log(`EMAIL_TEST_PASSWORD="${testAccount.pass}"`);
    
    // Test the connection
    const transporter = nodemailer.createTransporter({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    // Verify connection
    await transporter.verify();
    console.log('\n✅ Email configuration verified successfully!');
    
    // Send test email
    const info = await transporter.sendMail({
      from: '"Proof of Funds" <noreply@proofoffunds.com>',
      to: testAccount.user,
      subject: 'Test Email Configuration',
      text: 'If you receive this email, the configuration is working correctly!',
      html: '<h1>Test Email</h1><p>Email configuration is working! 🎉</p>'
    });
    
    console.log('📧 Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    
  } catch (error) {
    console.error('❌ Error setting up test email:', error);
  }
}

setupTestEmail();