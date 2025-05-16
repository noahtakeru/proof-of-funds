# Google Cloud Platform Setup for Proof of Funds

## Creating a New GCP Project

1. **Create Project**:
   ```bash
   # Using gcloud CLI
   gcloud projects create proof-of-funds-prod --name="Proof of Funds Production"
   
   # Or via Console:
   # 1. Go to console.cloud.google.com
   # 2. Click project dropdown → "New Project"
   # 3. Enter project name and ID
   ```

2. **Enable Required APIs**:
   ```bash
   # Set your project
   gcloud config set project proof-of-funds-prod
   
   # Enable Secret Manager API
   gcloud services enable secretmanager.googleapis.com
   ```

3. **Set up Authentication**:
   ```bash
   # Create service account
   gcloud iam service-accounts create proof-of-funds-sa \
     --display-name="Proof of Funds Service Account"
   
   # Grant permissions
   gcloud projects add-iam-policy-binding proof-of-funds-prod \
     --member="serviceAccount:proof-of-funds-sa@proof-of-funds-prod.iam.gserviceaccount.com" \
     --role="roles/secretmanager.admin"
   
   # Create and download key
   gcloud iam service-accounts keys create ./gcp-credentials.json \
     --iam-account=proof-of-funds-sa@proof-of-funds-prod.iam.gserviceaccount.com
   ```

4. **Configure Environment**:
   ```bash
   # Add to your .env file
   echo "GCP_PROJECT_ID=proof-of-funds-prod" >> .env
   echo "GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json" >> .env
   ```

## Quick Project ID Check

```javascript
// In your code, verify the project ID
console.log('GCP Project ID:', process.env.GCP_PROJECT_ID);
```

## Common Project ID Formats

- Usually lowercase letters, numbers, and hyphens
- Must be globally unique
- Examples:
  - `proof-of-funds-prod`
  - `my-app-123456`
  - `company-project-dev`

## Troubleshooting

If you can't find your project ID:

1. **Check your billing account** - Projects are listed there
2. **Search in Cloud Console** - Use the search bar
3. **Check your gcloud config**:
   ```bash
   gcloud config get-value project
   ```

Remember: Project ID is different from Project Name and Project Number!