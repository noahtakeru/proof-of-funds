/**
 * @fileoverview Request Signature Verifier
 * 
 * Provides functionality to verify signatures on requests for
 * the zero-knowledge proof system.
 * 
 * @author ZK Infrastructure Team
 * @created August 2024
 */

import * as crypto from 'crypto';

/**
 * Options for configuring the signature verifier
 */
export interface SignatureVerifierOptions {
    /** Algorithm to use for verification (default: 'sha256') */
    algorithm?: string;
    /** Public key encoding (default: 'base64') */
    encoding?: BufferEncoding;
    /** Whether to log verification attempts */
    verbose?: boolean;
}

/**
 * Verification result object
 */
export interface VerificationResult {
    /** Whether the signature is valid */
    valid: boolean;
    /** Message describing the result */
    message: string;
    /** Timestamp of verification */
    timestamp: string;
}

/**
 * Request Signature Verifier Class
 * 
 * Verifies that request signatures match the expected values
 */
class RequestSignatureVerifier {
    private algorithm: string;
    private encoding: BufferEncoding;
    private verbose: boolean;
    private publicKeys: Map<string, string>;

    /**
     * Creates a new Request Signature Verifier
     * @param options - Configuration options
     */
    constructor(options: SignatureVerifierOptions = {}) {
        this.algorithm = options.algorithm || 'sha256';
        this.encoding = options.encoding || 'base64';
        this.verbose = options.verbose || false;
        this.publicKeys = new Map<string, string>();

        this.log('RequestSignatureVerifier initialized');
    }

    /**
     * Register a public key for a specific key ID
     * @param keyId - Identifier for the key
     * @param publicKey - Public key value
     * @returns The current instance for chaining
     */
    public registerPublicKey(keyId: string, publicKey: string): RequestSignatureVerifier {
        this.publicKeys.set(keyId, publicKey);
        this.log(`Registered public key for: ${keyId}`);
        return this;
    }

    /**
     * Verify a signature for a payload
     * @param payload - The data payload that was signed
     * @param signature - The signature to verify
     * @param keyId - Optional key ID to use for verification (uses default if not provided)
     * @returns Promise resolving to true if signature is valid
     */
    public async verify(payload: any, signature: string, keyId?: string): Promise<boolean> {
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
     * @param payload - The data payload that was signed
     * @param signature - The signature to verify
     * @param keyId - Optional key ID to use for verification (uses default if not provided)
     * @returns Promise resolving to verification result
     */
    public async verifyWithDetails(
        payload: any,
        signature: string,
        keyId?: string
    ): Promise<VerificationResult> {
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
     * @param message - Message to log
     * @private
     */
    private log(message: string): void {
        if (this.verbose) {
            console.log(`[RequestSignatureVerifier] ${message}`);
        }
    }
}

export default RequestSignatureVerifier; 