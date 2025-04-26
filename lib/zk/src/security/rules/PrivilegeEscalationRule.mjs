/**
 * @fileoverview Security rule for detecting privilege escalation vulnerabilities in ZK proof systems
 * 
 * This rule analyzes code to identify potential privilege escalation issues
 * in zero-knowledge proof implementations, focusing on areas where unauthorized
 * access to restricted functionality might be possible.
 */

import { SecurityRule } from '../SecurityRule.js';

/**
 * Security rule to detect potential privilege escalation vulnerabilities
 */
export class PrivilegeEscalationRule extends SecurityRule {
    /**
     * Create a new PrivilegeEscalationRule
     */
    constructor() {
        super({
            id: 'privilege-escalation',
            name: 'Privilege Escalation',
            description: 'Detects potential privilege escalation vulnerabilities in ZK proof implementations',
            severity: 'critical',
            metadata: {
                moreInfoUrl: 'https://github.com/your-org/zk-security-rules/wiki/PrivilegeEscalationRule',
                exemptPatterns: [
                    // Patterns that should be exempt from this rule
                    /\/\/ SECURITY-REVIEWED:/i,
                    /\/\/ ACCESS-CONTROL-VERIFIED:/i
                ]
            }
        });

        // Initialize patterns for detecting privilege escalation vulnerabilities
        this.patterns = {
            missingAccessControl: [
                // Functions that might need access control but don't have checks
                /function\s+(admin|manage|set\w+|update\w+|delete\w+|add\w+|remove\w+|grant\w+|revoke\w+|change\w+|modify\w+)\s*\([^)]*\)\s*{(?![^}]*isAdmin|[^}]*hasRole|[^}]*isAuthorized|[^}]*checkPermission|[^}]*require\s*\(\s*msg\.sender)/i,
                // Admin or privileged functions without proper checks
                /function\s+\w+\s*\([^)]*\)\s*{[^}]*\/\/\s*admin\s+only[^}]*(?![^}]*isAdmin|[^}]*hasRole|[^}]*isAuthorized|[^}]*checkPermission|[^}]*require\s*\(\s*msg\.sender)/i
            ],
            hardcodedAccess: [
                // Hardcoded admin addresses or role checks
                /if\s*\(\s*msg\.sender\s*===?\s*['"]0x[a-fA-F0-9]{40}['"]\s*\)/i,
                /if\s*\(\s*address\s*===?\s*['"]0x[a-fA-F0-9]{40}['"]\s*\)/i,
                /['"]0x[a-fA-F0-9]{40}['"]\s*\/\/\s*admin/i
            ],
            insecureRoleAssignment: [
                // Functions that assign roles without proper validation
                /function\s+(setRole|grantRole|addAdmin|makeAdmin)\s*\([^)]*\)\s*{(?![^}]*require|[^}]*isAdmin|[^}]*onlyOwner)/i,
                // Directly setting admin/owner variables
                /\w+\.(admin|owner|superuser)\s*=\s*msg\.sender/i,
                /\w+\.(admin|owner|superuser)\s*=\s*_\w+/i
            ],
            bypassChecks: [
                // Developer backdoors or test code
                /\/\/\s*FIXME|TODO\s*:?\s*remove\s+before\s+production/i,
                /if\s*\(\s*debug\s*(?:===?\s*true|!==?\s*false)\s*\)\s*{\s*(?:return\s+true|isAdmin\s*=\s*true)/i,
                /\/\/\s*Bypass\s+for\s+testing/i,
                /if\s*\(\s*process\.env\.NODE_ENV\s*!==?\s*['"]production['"]\s*\)\s*{\s*(?:return\s+true|isAdmin\s*=\s*true)/i
            ],
            insecureProxyCall: [
                // Potential proxy/delegate call vulnerabilities
                /(?:delegatecall|callcode)\s*\(/i,
                /call\s*\(\s*[^)]*\)/i,
                /(?:eval|Function|new\s+Function)\s*\(/i
            ],
            exposedAdminFunctions: [
                // Public administrative functions without visibility modifiers
                /function\s+(?:admin|setOwner|transferOwnership|setAdmin|updateConfig)\s*\([^)]*\)(?!\s*(?:private|internal))/i
            ]
        };
    }

    /**
     * Check if this rule applies to the given file
     * 
     * @param {Object} context - The audit context
     * @returns {boolean} - Whether this rule applies
     */
    appliesTo(context) {
        // Check if the file contains any security-sensitive code
        const sensitivePatterns = [
            /admin/i,
            /role/i,
            /permission/i,
            /owner/i,
            /auth[a-z]*(?:tion|ize)/i,
            /access/i,
            /privilege/i,
            /proof/i,
            /verify/i,
            /validate/i,
            /check/i,
            /zkp/i,
            /delegatecall/i,
            /call\s*\(/i,
            /eval\s*\(/i
        ];

        return sensitivePatterns.some(pattern => pattern.test(context.code));
    }

    /**
     * Check for missing access control
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkMissingAccessControl(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.missingAccessControl) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Potential missing access control in privileged function',
                    severity: this.severity,
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Implement proper access control using role checks or authentication verification',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for hardcoded access controls
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkHardcodedAccess(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.hardcodedAccess) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Hardcoded access control check detected',
                    severity: 'high',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Use role-based access control instead of hardcoded addresses',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for insecure role assignment
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkInsecureRoleAssignment(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.insecureRoleAssignment) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Insecure role or privilege assignment detected',
                    severity: 'high',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Validate identity and authorization before assigning privileges',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for security bypass mechanisms
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkBypassChecks(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.bypassChecks) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Security check bypass mechanism detected',
                    severity: 'critical',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Remove debug/test bypass code before deploying to production',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for insecure proxy calls or dynamic code execution
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkInsecureProxyCall(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.insecureProxyCall) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                // For proxy calls, check if they're within a context of access checks
                const surroundingCode = this._getSurroundingCode(code, match.index, 200);
                if (/(?:isAdmin|hasRole|isAuthorized|checkPermission|require\s*\(\s*msg\.sender)/.test(surroundingCode)) {
                    continue; // Skip if there are access controls nearby
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Potential unsafe dynamic code execution detected',
                    severity: 'high',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Validate inputs and ensure proper access controls before dynamic execution',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for exposed administrative functions
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     */
    checkExposedAdminFunctions(code, filePath) {
        const findings = [];

        for (const pattern of this.patterns.exposedAdminFunctions) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Potentially exposed administrative function',
                    severity: 'medium',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Use appropriate visibility modifiers and access controls for administrative functions',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Evaluate the code for privilege escalation vulnerabilities
     * 
     * @param {Object} context - Evaluation context
     * @param {string} context.code - Code to evaluate
     * @param {string} context.filePath - Path of the file being evaluated
     * @returns {Object[]} Array of findings
     */
    evaluate(context) {
        if (!this.appliesTo(context)) {
            return [];
        }

        const { code, filePath } = context;

        const findings = [
            ...this.checkMissingAccessControl(code, filePath),
            ...this.checkHardcodedAccess(code, filePath),
            ...this.checkInsecureRoleAssignment(code, filePath),
            ...this.checkBypassChecks(code, filePath),
            ...this.checkInsecureProxyCall(code, filePath),
            ...this.checkExposedAdminFunctions(code, filePath),
            ...this._checkUnsafeAdminFunctions(code, filePath),
            ...this._checkImproperAccessControl(code, filePath),
            ...this._checkUncheckedParameters(code, filePath),
            ...this._checkUnsafeDynamicImports(code, filePath)
        ];

        return findings;
    }

    /**
     * Check for unsafe administrative functions without proper validations
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     * @private
     */
    _checkUnsafeAdminFunctions(code, filePath) {
        const findings = [];

        // Patterns for unsafe admin functions
        const unsafeAdminPatterns = [
            // Admin functions that modify critical state without validation
            /function\s+(updateConfig|setSystemParams|modifyProtocol)\s*\([^)]*\)\s*{(?![^}]*validate|[^}]*verify|[^}]*check)/i,

            // Functions that can change ownership or admin status without security checks
            /function\s+(changeOwner|updateAdmin|setControllingParty)\s*\([^)]*\)\s*{(?![^}]*multiSig|[^}]*timelock|[^}]*delay)/i,

            // Functions that can modify ZK proofs or verification parameters
            /function\s+(updateVerificationKey|setProofParameters|modifyCircuit)\s*\([^)]*\)\s*{(?![^}]*governance|[^}]*securityCheck)/i
        ];

        for (const pattern of unsafeAdminPatterns) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Unsafe administrative function without proper validations',
                    severity: 'critical',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Implement multi-signature, timelock, or governance processes for critical admin functions',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for improper access control mechanisms that could lead to privilege escalation
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     * @private
     */
    _checkImproperAccessControl(code, filePath) {
        const findings = [];

        // Patterns for improper access control
        const improperAccessPatterns = [
            // Client-side only access control
            /\/\/\s*Client-side\s+access\s+control/i,
            /\/\*\s*Client-side\s+access\s+control(?:(?!\*\/).)*\*\//is,

            // Role checks based only on client-provided data without verification
            /(?:role|isAdmin|hasPermission)\s*=\s*(?:req\.body|request\.data|payload|msg)\.(?:role|isAdmin|hasPermission)/i,

            // Using basic auth without additional security layers for admin functions
            /adminRouter\.use\(basicAuth\(\s*\{(?![^}]*custom|[^}]*additional)/i,

            // Missing JWT validation or using insecure JWT validation
            /function\s+verifyAdmin\s*\([^)]*\)\s*{(?![^}]*verify\s*\(|[^}]*decode\s*\()/i,

            // Overridable access controls
            /if\s*\([^)]*isAdmin(?:(?!return|throw).)*\)\s*{/i
        ];

        for (const pattern of improperAccessPatterns) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Improper access control that could lead to privilege escalation',
                    severity: 'high',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Implement server-side access control with proper authentication and authorization checks',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for unchecked parameters that could lead to privilege escalation
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     * @private
     */
    _checkUncheckedParameters(code, filePath) {
        const findings = [];

        // Patterns for unchecked parameters
        const uncheckedParamPatterns = [
            // Functions accepting user roles or permissions without validation
            /function\s+\w+\s*\(\s*(?:[^,)]*,\s*)*(?:role|permission|access|admin|privilege)(?:Level|Type|Value)?\s*(?:=[^=][^,)]*)?(?:,|\))/i,

            // Functions directly using parameters for access decisions without validation
            /if\s*\(\s*(?:params|args|options|config)\.(?:role|isAdmin|permission|access|privilege)/i,

            // User-controlled parameters flowing directly into privileged operations
            /\.executePrivileged\(\s*(?:(?:[^,)]*,\s*)*(?:params|args|options|config)\.(?:role|permission|access)|\$\{(?:params|args|options|config)\.(?:role|permission|access)\})/i,

            // ZK-specific: unchecked inputs flowing into proof verification
            /verify(?:Proof|ZKP|ZeroKnowledge)\(\s*(?:(?:[^,)]*,\s*)*(?:params|args|options|config)\.(?:inputs|publicInputs|privateInputs)|\$\{(?:params|args|options|config)\.(?:inputs|publicInputs|privateInputs)\})/i,

            // ZK-specific: protocol parameters being set without validation
            /set(?:Circuit|Protocol|ProofSystem)Parameters\(\s*(?:params|args|options|config)\.\w+/i
        ];

        for (const pattern of uncheckedParamPatterns) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                // Check if validation exists within a reasonable proximity
                const surroundingCode = this._getSurroundingCode(code, match.index, 300);
                if (/(?:validate|sanitize|check|verify)(?:Input|Param|Parameter|Request|Value)s?/.test(surroundingCode)) {
                    continue; // Skip if validation exists nearby
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Unchecked parameters that could lead to privilege escalation',
                    severity: 'high',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Validate all input parameters before using them in security-sensitive operations',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Check for unsafe dynamic imports that could lead to privilege escalation
     * 
     * @param {string} code - Code to check
     * @param {string} filePath - Path of the file being checked
     * @returns {Object[]} Array of findings
     * @private
     */
    _checkUnsafeDynamicImports(code, filePath) {
        const findings = [];

        // Patterns for unsafe dynamic imports
        const unsafeDynamicImportPatterns = [
            // Dynamic imports with variable paths
            /import\s*\(\s*(?:(?:"|').*(?:"|')\s*\+\s*.*|.*\s*\+\s*(?:"|').*(?:"|')|\$\{.*\})\s*\)/i,

            // require() with variable paths
            /require\s*\(\s*(?:(?:"|').*(?:"|')\s*\+\s*.*|.*\s*\+\s*(?:"|').*(?:"|')|\$\{.*\})\s*\)/i,

            // Loading modules with user-controlled input
            /(?:loadModule|importModule|loadPlugin|loadExtension|loadComponent)\s*\(\s*(?:req\.params|req\.query|req\.body|data|input|userInput)/i,

            // Unsafe dynamic eval of code
            /(?:eval|new\s+Function|Function)\s*\(\s*(?:(?:"|').*(?:"|')\s*\+\s*.*|.*\s*\+\s*(?:"|').*(?:"|')|\$\{.*\})\s*\)/i,

            // Unsafe JSON parsing that might execute code
            /JSON\.parse\s*\(\s*(?:(?:[^)]*\+[^)]*|[^)]*\$\{[^)]*\}[^)]*))(?![^)]*try)/i,

            // Unsafe module resolution
            /(?:resolveModule|resolvePlugin|resolveExtension|loadFromPath)\s*\(\s*(?:(?:[^)]*\+[^)]*|[^)]*\$\{[^)]*\}[^)]*))(?![^)]*sanitize|[^)]*validate)/i
        ];

        for (const pattern of unsafeDynamicImportPatterns) {
            const matches = Array.from(code.matchAll(new RegExp(pattern, 'g')));

            for (const match of matches) {
                if (this.isExemptPattern(match[0])) {
                    continue;
                }

                // Check if there's input validation nearby
                const surroundingCode = this._getSurroundingCode(code, match.index, 300);
                if (/(?:validatePath|sanitizePath|isAllowedPath|allowedModules|secureImport|secureRequire)/.test(surroundingCode)) {
                    continue; // Skip if validation exists nearby
                }

                const lineNumber = this._getLineNumber(code, match.index);
                findings.push({
                    rule: this.id,
                    message: 'Unsafe dynamic import that could lead to privilege escalation',
                    severity: 'critical',
                    lineNumber,
                    column: this._getColumn(code, match.index),
                    snippet: match[0],
                    recommendation: 'Use a whitelist approach for dynamic imports or validate and sanitize import paths',
                    filePath
                });
            }
        }

        return findings;
    }

    /**
     * Get the line number for a character position in code
     * 
     * @param {string} code - The code to analyze
     * @param {number} index - Character index
     * @returns {number} Line number (1-based)
     * @private
     */
    _getLineNumber(code, index) {
        return code.substring(0, index).split('\n').length;
    }

    /**
     * Get the column number for a character position in code
     * 
     * @param {string} code - The code to analyze
     * @param {number} index - Character index
     * @returns {number} Column number (1-based)
     * @private
     */
    _getColumn(code, index) {
        const lastNewline = code.lastIndexOf('\n', index);
        return lastNewline === -1 ? index + 1 : index - lastNewline;
    }

    /**
     * Get surrounding code context around a position
     * 
     * @param {string} code - The code to analyze
     * @param {number} index - Character index
     * @param {number} span - Number of characters to include before and after
     * @returns {string} The surrounding code
     * @private
     */
    _getSurroundingCode(code, index, span) {
        const start = Math.max(0, index - span);
        const end = Math.min(code.length, index + span);
        return code.substring(start, end);
    }
}

export default PrivilegeEscalationRule; 