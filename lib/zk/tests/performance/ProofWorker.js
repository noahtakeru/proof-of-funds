// Worker for parallel proof generation
import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';

// Import ZK proof system components
import { generateStandardProof } from '../../src/zkProofGenerator.js';
import { generateThresholdProof } from '../../src/zkProofGenerator.js';
import { generateMaximumProof } from '../../src/zkProofGenerator.js';

async function runWorker() {
    const { proofType, params } = workerData;
    const startTime = performance.now();

    try {
        let result;

        // Generate proof based on type
        switch (proofType) {
            case 'standard':
                result = await generateStandardProof(params);
                break;
            case 'threshold':
                result = await generateThresholdProof(params);
                break;
            case 'maximum':
                result = await generateMaximumProof(params);
                break;
            default:
                throw new Error(`Unknown proof type: ${proofType}`);
        }

        const endTime = performance.now();

        // Return result to parent
        parentPort.postMessage({
            success: true,
            proofType,
            result,
            time: endTime - startTime
        });
    } catch (error) {
        const endTime = performance.now();

        // Return error to parent
        parentPort.postMessage({
            success: false,
            proofType,
            error: error.message,
            stack: error.stack,
            time: endTime - startTime
        });
    }
}

// Run the worker
runWorker().catch(error => {
    console.error('Worker error:', error);
    process.exit(1);
}); 