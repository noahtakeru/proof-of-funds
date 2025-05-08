/**
 * API Endpoint to retrieve verification keys for ZK proofs
 * 
 * Responds to GET requests with the verification key for a specific proof type.
 * This endpoint is needed for browser-side verification of ZK proofs.
 */

import fs from 'fs';
import path from 'path';
import zkConfig from '@proof-of-funds/common/zk/config/real-zk-config.mjs';

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only GET requests are supported'
        });
    }

    try {
        // Get proof type from query
        const { proofType } = req.query;

        if (!proofType && proofType !== 0) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'proofType parameter is required'
            });
        }

        // Map proof type to circuit name
        const circuitName = typeof proofType === 'string' ?
            zkConfig.proofTypes[parseInt(proofType)] || 'standardProof' :
            zkConfig.proofTypes[proofType] || 'standardProof';

        // Get verification key path
        const vkeyPath = zkConfig.circuitPaths.vkeyPath(circuitName);
        const fullPath = path.resolve(process.cwd(), vkeyPath);

        // Check if verification key file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                error: 'Verification key not found',
                message: `Verification key for ${circuitName} not found`
            });
        }

        // Read and parse verification key
        const vkeyContent = fs.readFileSync(fullPath, 'utf8');
        const verificationKey = JSON.parse(vkeyContent);

        // Return verification key
        return res.status(200).json(verificationKey);
    } catch (error) {
        console.error('Error retrieving verification key:', error);

        return res.status(500).json({
            error: 'Server error',
            message: 'Error retrieving verification key'
        });
    }
} 