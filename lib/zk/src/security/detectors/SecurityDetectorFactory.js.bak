/**
 * Security Detector Factory
 * 
 * This module provides a factory for creating and managing security detectors
 * for ZK proof vulnerabilities. It loads all available detectors and provides
 * methods to retrieve them by ID, category, or severity.
 */

import { ReplayAttackDetector } from './ReplayAttackDetector.js';
import { MalleabilityDetector } from './MalleabilityDetector.js';
import { InputValidationDetector } from './InputValidationDetector.js';
import { VerificationBypassDetector } from './VerificationBypassDetector.js';
import { ImplementationVulnerabilityDetector } from './ImplementationVulnerabilityDetector.js';
import { AnomalyDetector, NotificationChannelType } from './AnomalyDetector.js';
import { SecurityRule } from '../rules/SecurityRule.js';
import { RuleCategory, Severity } from '../AuditConfig.js';

/**
 * Factory for creating and managing security detectors
 */
export class SecurityDetectorFactory {
    /**
     * Create a new SecurityDetectorFactory
     */
    constructor() {
        this.detectors = new Map();
        this.initialize();
    }

    /**
     * Initialize the factory with all available detectors
     */
    initialize() {
        console.debug('Initializing SecurityDetectorFactory');

        // Register all available detectors
        this.registerDetector(new ReplayAttackDetector());
        this.registerDetector(new MalleabilityDetector());
        this.registerDetector(new InputValidationDetector());
        this.registerDetector(new VerificationBypassDetector());
        this.registerDetector(new ImplementationVulnerabilityDetector());
        this.registerDetector(new AnomalyDetector());

        // More detectors will be added here as they are implemented

        console.info(`Registered ${this.detectors.size} security detectors`);
    }

    /**
     * Register a detector in the factory
     * 
     * @param {SecurityRule} detector - Detector to register
     * @returns {boolean} Success status
     */
    registerDetector(detector) {
        if (!detector || !detector.id) {
            console.warn('Attempted to register an invalid detector');
            return false;
        }

        // Check if detector is already registered
        if (this.detectors.has(detector.id)) {
            console.warn(`Detector with ID ${detector.id} is already registered`);
            return false;
        }

        this.detectors.set(detector.id, detector);
        console.debug(`Registered detector: ${detector.id} - ${detector.name}`);
        return true;
    }

    /**
     * Get all registered detectors
     * 
     * @returns {Array<SecurityRule>} All detectors
     */
    getAllDetectors() {
        return Array.from(this.detectors.values());
    }

    /**
     * Get a detector by ID
     * 
     * @param {string} id - Detector ID
     * @returns {SecurityRule|null} The detector or null if not found
     */
    getDetectorById(id) {
        return this.detectors.get(id) || null;
    }

    /**
     * Get detectors by severity level
     * 
     * @param {string} severity - Severity level
     * @returns {Array<SecurityRule>} Matching detectors
     */
    getDetectorsBySeverity(severity) {
        return this.getAllDetectors().filter(
            detector => detector.severity && detector.severity.toUpperCase() === severity.toUpperCase()
        );
    }

    /**
     * Get detectors by category
     * 
     * @param {string} category - Category
     * @returns {Array<SecurityRule>} Matching detectors
     */
    getDetectorsByCategory(category) {
        return this.getAllDetectors().filter(
            detector => detector.category && detector.category === category
        );
    }

    /**
     * Get detectors by name pattern
     * 
     * @param {string|RegExp} pattern - Pattern to match detector names
     * @returns {Array<SecurityRule>} Matching detectors
     */
    getDetectorsByNamePattern(pattern) {
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
        return this.getAllDetectors().filter(
            detector => detector.name && regex.test(detector.name)
        );
    }

    /**
     * Enable all detectors
     * 
     * @returns {number} Number of detectors enabled
     */
    enableAllDetectors() {
        let count = 0;
        for (const detector of this.detectors.values()) {
            if (!detector.enabled) {
                detector.enabled = true;
                count++;
            }
        }
        return count;
    }

    /**
     * Disable all detectors
     * 
     * @returns {number} Number of detectors disabled
     */
    disableAllDetectors() {
        let count = 0;
        for (const detector of this.detectors.values()) {
            if (detector.enabled) {
                detector.enabled = false;
                count++;
            }
        }
        return count;
    }

    /**
     * Enable a specific detector by ID
     * 
     * @param {string} id - Detector ID
     * @returns {boolean} Success status
     */
    enableDetector(id) {
        const detector = this.getDetectorById(id);
        if (detector) {
            detector.enabled = true;
            return true;
        }
        return false;
    }

    /**
     * Disable a specific detector by ID
     * 
     * @param {string} id - Detector ID
     * @returns {boolean} Success status
     */
    disableDetector(id) {
        const detector = this.getDetectorById(id);
        if (detector) {
            detector.enabled = false;
            return true;
        }
        return false;
    }

    /**
     * Get all enabled detectors
     * 
     * @returns {Array<SecurityRule>} Enabled detectors
     */
    getEnabledDetectors() {
        return this.getAllDetectors().filter(detector => detector.enabled);
    }

    /**
     * Create serialization-friendly representation of detectors
     * 
     * @returns {Object} Object with detector information
     */
    toJSON() {
        return {
            detectors: this.getAllDetectors().map(detector => ({
                id: detector.id,
                name: detector.name,
                description: detector.description,
                severity: detector.severity,
                enabled: detector.enabled
            }))
        };
    }
}

// Export a singleton instance
const detectorFactory = new SecurityDetectorFactory();
export default detectorFactory; 