# Production Security Guidelines

## 1. Service Account Management

### For Production, NEVER:
- Store service account keys in your codebase
- Use long-lived service account keys
- Share keys across environments

### Instead, Use:
- **Google Cloud Run/App Engine**: Automatic authentication via metadata service
- **Vercel**: Store credentials in environment variables (encrypted)
- **AWS**: Use workload identity federation
- **Self-hosted**: Use short-lived tokens with rotation

## 2. API Security

### Add Authentication
```javascript
// Example middleware
export default async function handler(req, res) {
  // Verify JWT token
  const token = req.headers.authorization?.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Your existing code...
}
```

### Add Rate Limiting
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // limit each IP to 10 requests per windowMs
});

export default limiter(handler);
```

### Add Cost Protection
- Set up budget alerts in GCP
- Monitor Cloud Storage usage
- Implement proof generation quotas per user

## 3. Environment Variables

### Development (.env.local)
```
GCP_PROJECT_ID=proof-of-funds-dev
GOOGLE_APPLICATION_CREDENTIALS=./dev-key.json
```

### Production (Platform Environment Variables)
```
GCP_PROJECT_ID=proof-of-funds-prod
# No GOOGLE_APPLICATION_CREDENTIALS - use platform auth
```

## 4. Deployment Checklist

- [ ] Remove all service account keys from codebase
- [ ] Set up proper authentication method for your platform
- [ ] Add API authentication (JWT/OAuth)
- [ ] Implement rate limiting
- [ ] Set up monitoring and alerts
- [ ] Use different GCP projects for dev/staging/prod
- [ ] Enable audit logging in GCP
- [ ] Restrict CORS to your domain only
- [ ] Add request validation and sanitization

## 5. Platform-Specific Setup

### Vercel
```javascript
// vercel.json
{
  "env": {
    "GCP_PROJECT_ID": "@gcp-project-id",
    "GCP_SERVICE_ACCOUNT": "@gcp-service-account"
  }
}
```

### Google Cloud Run
```bash
# Deploy with service account
gcloud run deploy proof-of-funds \
  --service-account=proof-of-funds-sa@PROJECT.iam.gserviceaccount.com
```

### Docker
```dockerfile
# Use secrets at runtime
ENV GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-key
```

## 6. Code Examples

### Secure API Endpoint
```javascript
import { verifyJWT } from '../../../utils/auth';
import { rateLimiter } from '../../../utils/rateLimiter';
import { validateInput } from '../../../utils/validation';

export default async function handler(req, res) {
  // 1. Check method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // 2. Verify authentication
  const user = await verifyJWT(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // 3. Rate limiting
  const rateLimitOk = await rateLimiter(req, user.id);
  if (!rateLimitOk) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  // 4. Validate input
  const validation = validateInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  // 5. Check user quota
  const quota = await checkUserQuota(user.id);
  if (quota.exceeded) {
    return res.status(403).json({ error: 'Quota exceeded' });
  }
  
  // Your proof generation code...
}
```

## 7. Monitoring

Set up alerts for:
- Unusual API usage patterns
- High Cloud Storage bandwidth
- Failed authentication attempts
- Error rate spikes
- Cost threshold breaches

Remember: Security is not just about code, it's about the entire deployment pipeline and operational practices.