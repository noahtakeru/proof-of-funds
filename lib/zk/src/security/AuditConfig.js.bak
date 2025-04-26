/**
 * Security Audit Configuration
 * 
 * Defines constants and configuration options for ZK security audits
 */

/**
 * Rule Categories
 * @enum {string}
 */
export const RuleCategory = {
    INPUT_VALIDATION: 'input-validation',
    CRYPTOGRAPHIC: 'cryptographic',
    ACCESS_CONTROL: 'access-control',
    DATA_EXPOSURE: 'data-exposure',
    ERROR_HANDLING: 'error-handling',
    IMPLEMENTATION: 'implementation',
    BUSINESS_LOGIC: 'business-logic',
    INFRASTRUCTURE: 'infrastructure',
    PRIVACY: 'privacy'
};

/**
 * Severity Levels
 * @enum {string}
 */
export const Severity = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    INFO: 'info'
};

/**
 * Default Audit Configuration
 */
export const DefaultAuditConfig = {
    // Maximum number of findings to report per rule
    maxFindingsPerRule: 25,

    // Default severity levels by category
    defaultSeverity: {
        [RuleCategory.INPUT_VALIDATION]: Severity.HIGH,
        [RuleCategory.CRYPTOGRAPHIC]: Severity.CRITICAL,
        [RuleCategory.ACCESS_CONTROL]: Severity.HIGH,
        [RuleCategory.DATA_EXPOSURE]: Severity.HIGH,
        [RuleCategory.ERROR_HANDLING]: Severity.MEDIUM,
        [RuleCategory.IMPLEMENTATION]: Severity.MEDIUM,
        [RuleCategory.BUSINESS_LOGIC]: Severity.HIGH,
        [RuleCategory.INFRASTRUCTURE]: Severity.MEDIUM,
        [RuleCategory.PRIVACY]: Severity.HIGH
    },

    // Rule execution timeout in milliseconds
    ruleTimeout: 30000,

    // Whether to stop execution after finding critical issues
    stopOnCritical: false,

    // Output formats
    outputFormats: ['json', 'html'],

    // Whether to include source code snippets in findings
    includeSourceSnippets: true,

    // Source line context (lines before and after finding)
    sourceLineContext: 3
};

/**
 * Create a customized audit configuration
 * 
 * @param {Object} overrides - Custom configuration options
 * @returns {Object} - Combined configuration
 */
export function createAuditConfig(overrides = {}) {
    return {
        ...DefaultAuditConfig,
        ...overrides,
        defaultSeverity: {
            ...DefaultAuditConfig.defaultSeverity,
            ...(overrides.defaultSeverity || {})
        }
    };
}

export default {
    RuleCategory,
    Severity,
    DefaultAuditConfig,
    createAuditConfig
}; 