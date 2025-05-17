# Browser Setup Guide for GCP

Since gcloud CLI is not installed, follow these browser-based steps:

## Step 1: Enable Secret Manager API

1. **Open this link in your browser:**
   https://console.cloud.google.com/flows/enableapi?apiid=secretmanager.googleapis.com&project=proof-of-funds-455506

2. Click the **"ENABLE"** button

3. Wait for confirmation that the API is enabled

## Step 2: Create Service Account & Download Key

1. **Go to Service Accounts page:**
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=proof-of-funds-455506

2. Click **"CREATE SERVICE ACCOUNT"**

3. Fill in:
   - Service account name: `proof-of-funds-zk-sa`
   - Service account ID: (will auto-fill)
   - Description: `Service account for ZK proofs`

4. Click **"CREATE AND CONTINUE"**

5. In the "Grant this service account access to project" section:
   - Click the role dropdown
   - Search for: `Secret Manager Admin`
   - Select it and click **"CONTINUE"**

6. Skip the optional third step, click **"DONE"**

7. Find your new service account in the list and click on it

8. Go to the **"KEYS"** tab

9. Click **"ADD KEY"** > **"Create new key"**

10. Choose **JSON** format and click **"CREATE"**

11. The key will download automatically - save it somewhere safe!

## Step 3: Set Up Your Downloaded Key

After downloading the JSON key file:

1. Move it to your project directory:
   ```bash
   mv ~/Downloads/proof-of-funds-455506-*.json ./gcp-sa-key.json
   ```

2. Set the environment variable in your terminal:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="./gcp-sa-key.json"
   ```

3. Add to your .env file (optional):
   ```bash
   echo 'GOOGLE_APPLICATION_CREDENTIALS=./gcp-sa-key.json' >> .env
   ```

## Step 4: Test Your Setup

Run the browser auth test:
```bash
node scripts/browser-auth-test.js
```

## Step 5: Deploy Your Keys

Once the test passes:
```bash
node scripts/deploy-keys-to-gcp.js
```

## Step 6: Update Frontend

Your frontend code should use the secure endpoints:
- Change `/api/zk/generateProof` to `/api/zk/generateProofSecure`

## Step 7: Clean Up

Remove public zkey files:
```bash
rm packages/frontend/public/lib/zk/circuits/*.zkey
```

## Important Security Notes

- **NEVER commit the JSON key file to git!**
- Add `*.json` and `gcp-sa-key.json` to your `.gitignore`
- Store the key file securely
- Rotate keys periodically

## Verification Links

- [Check if Secret Manager API is enabled](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com?project=proof-of-funds-455506)
- [View your service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=proof-of-funds-455506)
- [View Secret Manager](https://console.cloud.google.com/security/secret-manager?project=proof-of-funds-455506)