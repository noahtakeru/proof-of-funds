# GCP Deployment Checklist for Proof of Funds

## Your Project Details
- **Project ID**: `proof-of-funds-455506`
- **Project Name**: Proof of Funds

## Step 1: Enable Secret Manager API ⚠️

Choose one of these methods:

### Option A: Direct Link (Easiest)
1. [Click here to enable Secret Manager API](https://console.cloud.google.com/flows/enableapi?apiid=secretmanager.googleapis.com&project=proof-of-funds-455506)
2. Click "ENABLE"

### Option B: Console UI
1. Go to [APIs & Services](https://console.cloud.google.com/apis/library?project=proof-of-funds-455506)
2. Search for "Secret Manager"
3. Click on "Secret Manager API"
4. Click "ENABLE"

### Option C: Cloud Shell
```bash
gcloud services enable secretmanager.googleapis.com --project=proof-of-funds-455506
```

## Step 2: Set Up Authentication

Choose one:

### Option A: Application Default Credentials (Recommended for Development)
```bash
gcloud auth application-default login
```

### Option B: Service Account (Recommended for Production)
1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=proof-of-funds-455506)
2. Click "CREATE SERVICE ACCOUNT"
3. Name: `proof-of-funds-zk-sa`
4. Grant role: `Secret Manager Admin`
5. Create and download JSON key
6. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/key.json"
   ```

## Step 3: Verify Setup

Run the verification script:
```bash
cd /Users/karpel/Desktop/GitHub/proof-of-funds
node scripts/verify-gcp-deployment.js
```

Expected output:
```
✅ GCP deployment verified successfully!
```

## Step 4: Deploy ZK Keys

Once verification passes:
```bash
node scripts/deploy-keys-to-gcp.js
```

This will upload your zkey files to Google Cloud Secret Manager.

## Step 5: Update Frontend Code

Replace API calls:
```javascript
// Old
fetch('/api/zk/generateProof', ...)

// New (secure)
fetch('/api/zk/generateProofSecure', ...)
```

## Step 6: Clean Up Public Keys

Remove sensitive files from public access:
```bash
rm packages/frontend/public/lib/zk/circuits/*.zkey
```

## Troubleshooting

### "API not enabled" Error
- Make sure you completed Step 1
- Wait 1-2 minutes after enabling
- Check if billing is enabled for the project

### "Permission denied" Error
- Complete Step 2 authentication
- Ensure your account has the right permissions
- For service accounts, check the JSON key path

### "Project not found" Error
- Verify project ID: `proof-of-funds-455506`
- Ensure you're logged into the right Google account
- Check `gcloud config get-value project`

## Quick Test

After setup, you can test with:
```javascript
// Test if everything works
const ZKeyManager = require('./packages/backend/utils/zkeyManager');
const manager = new ZKeyManager();

// Should not throw errors if setup correctly
manager.getZKey('standard').then(console.log).catch(console.error);
```

## Security Best Practices

1. **Never commit** service account keys to git
2. **Rotate keys** periodically
3. **Use least privilege** - only grant necessary permissions
4. **Monitor access** - check Secret Manager logs
5. **Separate environments** - use different projects for dev/prod

---

Once these steps are complete, your ZK proofs will use secure cloud storage instead of public files!