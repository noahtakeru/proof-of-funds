/**
 * @fileoverview Request Signature Verifier
 * 
 * Provides functionality to verify signatures on requests for
 * the zero-knowledge proof system.
 * 
 * @author ZK Infrastructure Team
 * @created August 2024
 */

const crypto = require('crypto');

/**
 * Request Signature Verifier Class
 * 
 * Verifies that request signatures match the expected values
 */
class RequestSignatureVerifier {
    /**
     * Creates a new Request Signature Verifier
     * @param {Object} options - Configuration options
     * @param {string} [options.algorithm='sha256'] - Algorithm to use for verification
     * @param {string} [options.encoding='base64'] - Encoding for keys and signatures
     * @param {boolean} [options.verbose=false] - Whether to log verification attempts
     */
    constructor(options = {}) {
        this.algorithm = options.algorithm || 'sha256';
        this.encoding = options.encoding || 'base64';
        this.verbose = options.verbose || false;
        this.publicKeys = new Map();

        this.log('RequestSignatureVerifier initialized');
    }

    /**
     * Register a public key for a specific key ID
     * @param {string} keyId - Identifier for the key
     * @param {string} publicKey - Public key value
     * @returns {RequestSignatureVerifier} The current instance for chaining
     */
    registerPublicKey(keyId, publicKey) {
        this.publicKeys.set(keyId, publicKey);
        this.log(`Registered public key for: ${keyId}`);
        return this;
    }

    /**
     * Verify a signature for a payload
     * @param {any} payload - The data payload that was signed
     * @param {string} signature - The signature to verify
     * @param {string} [keyId] - Optional key ID to use for verification (uses default if not provided)
     * @returns {Promise<boolean>} Promise resolving to true if signature is valid
     */
    async verify(payload, signature, keyId) {
        try {
            const verificationResult = await this.verifyWithDetails(payload, signature, keyId);
            return verificationResult.valid;
        } catch (error) {
            this.log(`Verification error: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Verify a signature with detailed results
     * @param {any} payload - The data payload that was signed
     * @param {string} signature - The signature to verify
     * @param {string} [keyId] - Optional key ID to use for verification (uses default if not provided)
     * @returns {Promise<Object>} Promise resolving to verification result
     */
    async verifyWithDetails(payload, signature, keyId) {
        this.log(`Verifying signature for payload: ${typeof payload === 'object' ? 'object' : payload}`);

        try {
            // Get the key to use for verification
            const actualKeyId = keyId || 'default';
            const publicKey = this.publicKeys.get(actualKeyId);

            if (!publicKey) {
                return {
                    valid: false,
                    message: `No public key registered for ID: ${actualKeyId}`,
                    timestamp: new Date().toISOString()
                };
            }

            // Prepare payload for verification
            const dataToVerify = typeof payload === 'string'
                ? payload
                : JSON.stringify(payload);

            // Decode signature
            const signatureBuffer = Buffer.from(signature, this.encoding);

            // Create verifier
            const verifier = crypto.createVerify(this.algorithm);
            verifier.update(dataToVerify);

            // Verify signature
            const isValid = verifier.verify(publicKey, signatureBuffer);

            // Return result
            const result = {
                valid: isValid,
                message: isValid ? 'Signature verified successfully' : 'Invalid signature',
                timestamp: new Date().toISOString()
            };

            this.log(`Verification result: ${result.message}`);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`Error during verification: ${errorMessage}`);

            return {
                valid: false,
                message: `Verification error: ${errorMessage}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Log a message if verbose mode is enabled
     * @param {string} message - Message to log
     * @private
     */
    log(message) {
        if (this.verbose) {
            console.log(`[RequestSignatureVerifier] ${message}`);
        }
    }
}

module.exports = RequestSignatureVerifier;