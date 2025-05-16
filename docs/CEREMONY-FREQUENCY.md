# Trusted Setup Ceremony Frequency Guide

## When You Need a New Ceremony

### 1. Initial Deployment ✅
- **Frequency**: Once
- **When**: Before first production deployment
- **What**: Complete ceremony for all circuit types

### 2. Circuit Structure Changes ❗
- **Frequency**: Each time circuits change
- **When**: 
  - Adding new constraints
  - Modifying circuit logic
  - Changing input/output structure
- **Example**: If you change standardProof.circom logic

### 3. Major Security Updates 🔒
- **Frequency**: Rarely
- **When**:
  - Cryptographic vulnerabilities discovered
  - Upgrading to new curve parameters
  - Security audit recommendations

### 4. Never Need New Ceremony For 📝
- Changing business logic outside circuits
- Frontend updates
- API modifications
- Adding new proof types (if using same circuit structure)

## Automation Capabilities

### ✅ Can Be Automated:
1. **Contribution Collection**
   ```javascript
   // Automated contribution API
   app.post('/ceremony/contribute', async (req, res) => {
     const { token, contributionFile } = req.body;
     const result = await coordinator.processContribution(token, contributionFile);
     res.json(result);
   });
   ```

2. **Verification Process**
   ```bash
   # Automated verification
   ./verify-ceremony.sh
   ```

3. **Participant Coordination**
   - Email notifications
   - Contribution deadlines
   - Progress tracking

4. **Final Compilation**
   - Beacon application
   - Phase 2 preparation
   - File distribution

### ❌ Cannot Be Automated:
1. **Human Entropy Generation**
   - Each participant must provide random input
   - Cannot be predetermined

2. **Trust Distribution**
   - Need diverse, independent participants
   - Manual vetting of contributors

3. **Attestation Signing**
   - Participants must manually sign attestations
   - Legal/compliance requirements

## Recommended Ceremony Schedule

### For Proof of Funds Protocol:

1. **Initial Setup** (Now)
   - 3-5 participants minimum
   - Include: Company, auditor, community members

2. **Annual Security Review**
   - Assess if circuits need updates
   - Only re-run if changes required

3. **Circuit Updates**
   ```javascript
   // Track circuit versions
   const CIRCUIT_VERSIONS = {
     standard: "1.0.0",  // No ceremony needed until version change
     threshold: "1.0.0",
     maximum: "1.0.0"
   };
   ```

## Quick Decision Tree

```
Need new ceremony?
│
├─ First deployment? → YES
│
├─ Changed circuit files? → YES
│
├─ Security vulnerability? → YES
│
└─ Everything else → NO
```

## Cost-Benefit Analysis

### One-Time Setup
- **Cost**: ~1 week coordination
- **Benefit**: Permanent cryptographic security

### Per-Circuit Update
- **Cost**: ~3 days ceremony
- **Benefit**: Maintains security with new features

### Recommendation
- Use same Powers of Tau for multiple circuits
- Only regenerate when circuit structure changes
- Automate coordination, not randomness