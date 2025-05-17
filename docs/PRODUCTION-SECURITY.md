# Essential Production Security Guidelines

## Rules
1. No mock or placeholder code. We want to know where we're failing.
2. If something is confusing, don't create crap - stop, make note and consult.
3. Always check if an implementation, file, test, architecture, function or code exists before making any new files or folders.
4. Understand the entire codebase (make sure you grok it before making changes).
5. Review this entire plan and its progress before coding.
6. If you make a new code file - indicate that this is new and exactly what it's needed for. Also make sure there isn't mock or placeholder crap code in here either. Fallback code is NOT ACCEPTABLE EITHER. WE NEED TO KNOW WHEN AND WHERE WE FAIL.
7. Unless a plan or test file was made during this phased sprint (contained in this document) - I'd assume it's unreliable until its contents are analyzed thoroughly. Confirm its legitimacy before proceeding with trusting it blindly. Bad assumptions are unacceptable.
8. Put all imports at the top of the file it's being imported into.
9. Record all progress in this document.
10. Blockchain testing will be done on Polygon Amoy, so keep this in mind.
11. Do not make any UI changes. I like the way the frontend looks at the moment.
12. Track your progress in this file. Do not make more tracking or report files. They're unnecessary.
13. Price estimates are unacceptable. We are building for production, so it's important to prioritize building working code that doesn't rely on mock data or placeholder implementation. NOTHING "FAKE".

## 1. Service Account Management

### For Production, NEVER:
- Store service account keys in your codebase
- Use long-lived service account keys
- Share keys across environments

### Instead, Use:
- Secure environment variables for credential storage
- Platform-managed service identities when available
- Short-lived tokens with rotation

## 2. API Security

### Add Authentication
```javascript
// Example middleware
export default async function handler(req, res) {
  // Verify authentication
  const token = req.headers.authorization?.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Your existing code...
}
```

### Add Rate Limiting
- Implement API rate limits to prevent abuse
- Apply different limits based on endpoint sensitivity
- Track requests by IP and/or user ID

### Add Input Validation
- Validate all API inputs before processing
- Use strict type checking and parameter validation
- Return secure error messages that don't leak details

## 3. Environment Variables

- Use different credentials for development and production
- Never commit sensitive values to your codebase
- Use your deployment platform's secret management

## 4. Deployment Checklist

- [ ] Remove all service account keys from codebase
- [ ] Add API authentication (JWT/OAuth)
- [ ] Implement rate limiting
- [ ] Add request validation and sanitization
- [ ] Restrict CORS to your domain only
- [ ] Implement secure error handling

## 5. Blockchain-Specific Security

- Set maximum gas price limits
- Implement funding limits for temporary wallets
- Monitor service wallet balances
- Validate all blockchain transactions before submission

Remember: Security is not just about code, it's about the entire system architecture and operational practices.