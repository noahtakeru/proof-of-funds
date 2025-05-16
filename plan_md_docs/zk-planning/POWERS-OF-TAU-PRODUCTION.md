# Powers of Tau Production Guide

## Overview

The Powers of Tau ceremony is a cryptographic multi-party computation protocol that generates the parameters needed for zk-SNARKs. For production use, this process MUST be done with real entropy (randomness) to ensure the security of the system.

## Why Manual Entropy is Required

1. **Security**: The security of the entire ZK proof system depends on the randomness used in the Powers of Tau ceremony
2. **Trust**: Using predictable inputs (like "test_entropy_12345") makes the system vulnerable to attacks
3. **Production Requirements**: Real deployments require true randomness to prevent malicious actors from reconstructing the toxic waste

## Production Process

When running `./scripts/generate-keys-production.sh`, you will be prompted multiple times to enter random text. Here's what to do:

### Step 1: First Contribution
- When prompted "Enter a random text. (Entropy):"
- Type random characters, words, or phrases
- Press Enter when done
- Example: `asdkfj3948fjdksl39485jfkdls9384jfkdls`

### Step 2: Second Contribution
- When prompted again for entropy
- Enter different random text
- Example: `mydog8392jumped0ver7the3fence2today`

## Best Practices for Entropy

1. **Use truly random inputs**: 
   - Keyboard mashing
   - Random words
   - Mix of letters, numbers, symbols
   
2. **Never reuse entropy**:
   - Each contribution should use unique random text
   - Don't use the same entropy across different ceremonies

3. **Don't use predictable patterns**:
   - Avoid sequential numbers
   - Don't use common phrases
   - Avoid personal information

## Security Considerations

1. **Secure Environment**: Run the ceremony on a secure, trusted machine
2. **Network Security**: Ensure no one can intercept your entropy inputs
3. **Key Storage**: After generation, store .zkey files securely
4. **Verification Keys**: .vkey.json files can be made public
5. **Toxic Waste**: The ceremony automatically destroys intermediate values

## Post-Generation

After successful key generation:

1. Verify the keys work by running proof generation tests
2. Back up the .zkey files securely
3. Deploy .vkey.json files for public verification
4. Never expose the entropy used in the ceremony

## Important Notes

- The production script will fail if circuit compilation hasn't completed
- Each proof type requires its own key generation
- The process may take several minutes depending on circuit complexity
- Always use the production script for real deployments, never the automated version