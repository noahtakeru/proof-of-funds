# Service Account Setup Guide

This guide provides instructions for setting up service accounts according to the security practices outlined in the PRODUCTION-SECURITY.md document.

## Overview

Service accounts are used to authenticate your application with cloud services. Following best practices:

- **Never store service account keys in your codebase**
- **Use short-lived credentials or managed identities when possible**
- **Use different service accounts for different environments**

## 1. Google Cloud Platform (GCP) Setup

### Creating a Service Account

1. Go to the [GCP IAM Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Select your project
3. Click "Create Service Account"
4. Enter a name (e.g., `proof-of-funds-app`)
5. Add description: "Service account for Proof of Funds application"
6. Click "Create and Continue"
7. Assign the following roles:
   - Storage Object Admin (for zkey files)
   - Secret Manager Secret Accessor (if using Secret Manager)
8. Click "Done"

### Assign Specific Permissions

For more granular control:

```bash
# Grant storage permissions to specific bucket only
gcloud storage buckets add-iam-policy-binding gs://YOUR_BUCKET_NAME \
  --member="serviceAccount:proof-of-funds-app@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### Option 1: Workload Identity (Recommended)

For GCP deployment platforms like Cloud Run:

```bash
# Create service account for Cloud Run
gcloud iam service-accounts create proof-of-funds-run

# Grant permissions to the service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:proof-of-funds-run@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Deploy to Cloud Run with service account
gcloud run deploy proof-of-funds \
  --image=gcr.io/YOUR_PROJECT_ID/proof-of-funds \
  --service-account=proof-of-funds-run@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### Option 2: Service Account Key (For Non-GCP Platforms)

Only if you can't use Workload Identity:

```bash
# Generate a key (avoid when possible)
gcloud iam service-accounts keys create key.json \
  --iam-account=proof-of-funds-app@YOUR_PROJECT_ID.iam.gserviceaccount.com
  
# Remember to set an expiration reminder
echo "Service account key expires in 30 days: $(date -d '+30 days')"
```

## 2. Vercel Deployment

For deploying to Vercel:

### Environment Variables

Set these in Vercel project settings:

* For Workload Identity Federation (Advanced):
  ```
  GCP_WORKLOAD_IDENTITY_PROVIDER=projects/XXXX/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider
  GCP_SERVICE_ACCOUNT=proof-of-funds-app@YOUR_PROJECT_ID.iam.gserviceaccount.com
  ```

* For service account key method:
  ```
  # Warning: Less secure approach
  GCP_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
  ```

### Authentication Flow

1. **Development**: Uses local application default credentials
2. **Production**: Uses Vercel environment variables:
   - Workload Identity (preferred): App authenticates via Vercel's identity
   - Service Account JSON: Retrieved from environment, not stored in code

## 3. AWS Deployment

For AWS Lambda or ECS:

### IAM Role Configuration

1. Create an IAM role with the necessary permissions
2. Configure your Lambda or ECS task to use the role
3. Use AWS SDK to obtain Google Cloud credentials via credential exchange

### Environment Setup

```
# For AWS/GCP credential exchange
AWS_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/GcpCredentialExchangeRole
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/XXXX/locations/global/workloadIdentityPools/aws-pool/providers/aws-provider
GCP_SERVICE_ACCOUNT=proof-of-funds-app@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## Security Checks

Before deployment, verify:

- [ ] No service account keys in repository
- [ ] Service account has minimum required permissions
- [ ] Using workload identity or managed identities when possible
- [ ] Different service accounts for dev/prod environments
- [ ] If using keys, they are short-lived and rotated regularly

## Troubleshooting

For permission issues:

1. Check IAM role assignments
2. Verify bucket ACLs
3. Review service account email address
4. Check for typos in environment variables
5. Verify deployment platform's credential handling