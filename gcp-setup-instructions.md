# GCP Setup Instructions for proof-of-funds-455506

## 1. Enable Required APIs

Run these commands in Google Cloud Shell or with gcloud CLI:

```bash
# Set project
gcloud config set project proof-of-funds-455506

# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Verify it's enabled
gcloud services list --enabled | grep secretmanager
```

## 2. Create Service Account (if needed)

```bash
# Create service account
gcloud iam service-accounts create proof-of-funds-zk-sa \
  --display-name="Proof of Funds ZK Service Account" \
  --project=proof-of-funds-455506

# Grant Secret Manager permissions
gcloud projects add-iam-policy-binding proof-of-funds-455506 \
  --member="serviceAccount:proof-of-funds-zk-sa@proof-of-funds-455506.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

# Create and download service account key
gcloud iam service-accounts keys create ./gcp-sa-key.json \
  --iam-account=proof-of-funds-zk-sa@proof-of-funds-455506.iam.gserviceaccount.com \
  --project=proof-of-funds-455506
```

## 3. Configure Application Default Credentials

For local development:

```bash
# Option 1: Use service account key
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-sa-key.json"

# Option 2: Use your personal credentials
gcloud auth application-default login
```

## 4. Test Secret Manager Access

```bash
# Create a test secret
echo "test-value" | gcloud secrets create test-secret \
  --data-file=- \
  --project=proof-of-funds-455506

# Read it back
gcloud secrets versions access latest \
  --secret=test-secret \
  --project=proof-of-funds-455506

# Delete test secret
gcloud secrets delete test-secret \
  --project=proof-of-funds-455506
```

## 5. Deploy ZK Keys

Once APIs are enabled and authentication is configured:

```bash
# Deploy zkeys to Google Cloud Secret Manager
node scripts/deploy-keys-to-gcp.js
```

## 6. Update Application Code

Update your API endpoints to use the secure versions:

```javascript
// Instead of: /api/zk/generateProof
// Use: /api/zk/generateProofSecure
```

## Next Steps

1. Enable the Secret Manager API (required)
2. Set up authentication (service account or personal)
3. Deploy the zkeys
4. Test the secure endpoints
5. Remove local zkey files from public directories
