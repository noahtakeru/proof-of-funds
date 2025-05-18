# Complete GCP Setup Guide

## Current Status
✅ Authentication is working  
✅ Secret Manager API is enabled  
❌ ZKey files are too large for Secret Manager (65KB limit)  
❌ Service account lacks Cloud Storage permissions  

## Your Options

### Option 1: Add Cloud Storage Permissions (Recommended)
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=proof-of-funds-455506
2. Find `proof-of-funds-zk-sa@proof-of-funds-455506.iam.gserviceaccount.com`
3. Click Edit → Add Role → `Storage Admin`
4. Save and run:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="./gcp-sa-key.json"
   node scripts/deploy-keys-to-storage.js
   ```

### Option 2: Use Firebase Storage (Simpler)
Since you already have Firebase, use their storage:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-sa-key.json"
node scripts/deploy-keys-to-firebase.js
```

### Option 3: Split Storage Strategy
- Small data (metadata) → Secret Manager
- Large files (zkeys) → Cloud Storage or Firebase
- Configuration → Environment variables

## File Size Summary
- standardProof.zkey: 596KB
- maximumProof.zkey: 892KB  
- thresholdProof.zkey: 1.0MB
- Secret Manager limit: 65KB

## Next Steps After Choosing
1. Deploy zkeys to your chosen storage
2. Update frontend API endpoints
3. Remove public zkey files
4. Test the implementation

## Quick Decision
- Want simple? → Use Firebase Storage
- Want Google Cloud? → Add Storage permissions
- Want hybrid? → Use both services