/**
 * Bridge file for real-zk-config
 * This provides a minimal configuration to break circular dependencies.
 */
// Configuration for circuit file paths
const zkConfig = {
    // Mapping of proof types to circuit names
    proofTypes: {
        'standard': 'standardProof',
        '0': 'standardProof',
        'threshold': 'thresholdProof',
        '1': 'thresholdProof',
        'maximum': 'maximumProof',
        '2': 'maximumProof'
    },
    // Circuit configurations
    circuitConfig: {
        'standard': { constraints: 100000 },
        'threshold': { constraints: 120000 },
        'maximum': { constraints: 120000 },
        'standardProof': { constraints: 100000 },
        'thresholdProof': { constraints: 120000 },
        'maximumProof': { constraints: 120000 }
    },
    circuitPaths: {
        // Base circuit paths - using public directory paths for Next.js
        standard: {
            wasm: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/standardProof.wasm'
                : './lib/zk/circuits/standardProof.wasm',
            zkey: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/standardProof.zkey'
                : './lib/zk/circuits/standardProof.zkey',
            vkey: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/standardProof.vkey.json'
                : './lib/zk/circuits/standardProof.vkey.json'
        },
        threshold: {
            wasm: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/thresholdProof.wasm'
                : './lib/zk/circuits/thresholdProof.wasm',
            zkey: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/thresholdProof.zkey'
                : './lib/zk/circuits/thresholdProof.zkey',
            vkey: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/thresholdProof.vkey.json'
                : './lib/zk/circuits/thresholdProof.vkey.json'
        },
        maximum: {
            wasm: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/maximumProof.wasm'
                : './lib/zk/circuits/maximumProof.wasm',
            zkey: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/maximumProof.zkey'
                : './lib/zk/circuits/maximumProof.zkey',
            vkey: process.env.NODE_ENV === 'production'
                ? '/lib/zk/circuits/maximumProof.vkey.json'
                : './lib/zk/circuits/maximumProof.vkey.json'
        },
        // Helper functions to get paths for a specific circuit
        wasmPath: function (circuitName) {
            // Convert standard/threshold/maximum to the full names if needed
            const normalizedName = circuitName.endsWith('Proof') ?
                circuitName :
                `${circuitName}Proof`;
            // Get the right circuit config
            const baseKey = normalizedName.replace('Proof', '');
            if (!this[baseKey]) {
                console.error(`Unknown circuit: ${circuitName}, baseKey: ${baseKey}`);
                // Fallback to standard proof
                return this.standard.wasm;
            }
            return this[baseKey].wasm;
        },
        zkeyPath: function (circuitName) {
            // Convert standard/threshold/maximum to the full names if needed
            const normalizedName = circuitName.endsWith('Proof') ?
                circuitName :
                `${circuitName}Proof`;
            // Get the right circuit config
            const baseKey = normalizedName.replace('Proof', '');
            if (!this[baseKey]) {
                console.error(`Unknown circuit: ${circuitName}, baseKey: ${baseKey}`);
                // Fallback to standard proof
                return this.standard.zkey;
            }
            return this[baseKey].zkey;
        },
        vkeyPath: function (circuitName) {
            // Convert standard/threshold/maximum to the full names if needed
            const normalizedName = circuitName.endsWith('Proof') ?
                circuitName :
                `${circuitName}Proof`;
            // Get the right circuit config
            const baseKey = normalizedName.replace('Proof', '');
            if (!this[baseKey]) {
                console.error(`Unknown circuit: ${circuitName}, baseKey: ${baseKey}`);
                // Fallback to standard proof
                return this.standard.vkey;
            }
            return this[baseKey].vkey;
        }
    },
    // Constants for proof generation
    constants: {
        memoryLimits: {
            standard: 1024 * 1024 * 1024, // 1GB
            threshold: 1536 * 1024 * 1024, // 1.5GB
            maximum: 2048 * 1024 * 1024 // 2GB
        },
        fieldSize: BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
    },
    // Verification settings
    verification: {
        serverEndpoint: '/api/zk/verify',
        clientSideVerification: true,
        cacheResults: true
    }
};
export default zkConfig;
