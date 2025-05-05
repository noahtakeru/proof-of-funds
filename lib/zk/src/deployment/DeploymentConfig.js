/**
 * DeploymentConfig
 * 
 * Manages the configuration for deploying ZK proofs.
 * Provides a unified interface for handling deployment settings
 * across different environments.
 */

export class DeploymentConfig {
    /**
     * Creates a new deployment configuration
     * 
     * @param {Object} options - Initial configuration options
     */
    constructor(options = {}) {
        // Default configuration values
        this.defaults = {
            environment: 'auto',
            circuitPath: '',
            outputDir: './zkproof-output',
            optimizationLevel: 1,
            securityLevel: 'standard',
            cacheEnabled: true,
            enableCompression: true,
            timeout: 120000, // 2 minutes
            retries: 3,
            verbose: false,
            logLevel: 'info',
            memoryLimit: '4GB',
            enableParallelization: true,
            maxWorkers: 4,
            metrics: {
                collect: true,
                endpoint: ''
            },
            validationMode: 'strict',
            customParams: {}
        };

        // Apply user configuration on top of defaults
        this.config = { ...this.defaults, ...options };

        // Environment-specific configurations
        this.envConfigs = {
            Browser: {},
            Cloud: {},
            Node: {}
        };
    }

    /**
     * Gets the current configuration value
     * 
     * @param {string} key - The configuration key to get
     * @param {*} defaultValue - Default value if key is not found
     * @returns {*} The configuration value
     */
    get(key, defaultValue) {
        return key in this.config ? this.config[key] : defaultValue;
    }

    /**
     * Sets a configuration value
     * 
     * @param {string} key - The configuration key to set
     * @param {*} value - The value to set
     * @returns {DeploymentConfig} This configuration instance for chaining
     */
    set(key, value) {
        this.config[key] = value;
        return this;
    }

    /**
     * Sets multiple configuration values at once
     * 
     * @param {Object} configObject - Object containing configuration key-value pairs
     * @returns {DeploymentConfig} This configuration instance for chaining
     */
    setMultiple(configObject) {
        Object.assign(this.config, configObject);
        return this;
    }

    /**
     * Sets environment-specific configuration
     * 
     * @param {string} environment - Target environment (Browser, Cloud, Node)
     * @param {Object} configObject - Configuration for the environment
     * @returns {DeploymentConfig} This configuration instance for chaining
     */
    setEnvironmentConfig(environment, configObject) {
        if (!this.envConfigs[environment]) {
            this.envConfigs[environment] = {};
        }

        Object.assign(this.envConfigs[environment], configObject);
        return this;
    }

    /**
     * Gets the merged configuration for a specific environment
     * 
     * @param {string} environment - Target environment (Browser, Cloud, Node)
     * @returns {Object} The merged configuration
     */
    getEnvironmentConfig(environment) {
        const envConfig = this.envConfigs[environment] || {};
        return { ...this.config, ...envConfig };
    }

    /**
     * Validates the current configuration
     * 
     * @returns {Object} Validation result with success flag and messages
     */
    validate() {
        const result = {
            success: true,
            messages: []
        };

        // Check for required fields
        if (!this.config.circuitPath) {
            result.success = false;
            result.messages.push('Circuit path is required');
        }

        // Check optimization level range
        if (this.config.optimizationLevel < 0 || this.config.optimizationLevel > 3) {
            result.success = false;
            result.messages.push('Optimization level must be between 0 and 3');
        }

        // Check security level
        const validSecurityLevels = ['minimal', 'standard', 'high'];
        if (!validSecurityLevels.includes(this.config.securityLevel)) {
            result.success = false;
            result.messages.push(`Security level must be one of: ${validSecurityLevels.join(', ')}`);
        }

        // Check timeout value
        if (this.config.timeout < 0) {
            result.success = false;
            result.messages.push('Timeout must be a positive number');
        }

        // Check memory limit format
        if (typeof this.config.memoryLimit === 'string') {
            const memoryPattern = /^(\d+)(KB|MB|GB)$/i;
            if (!memoryPattern.test(this.config.memoryLimit)) {
                result.success = false;
                result.messages.push('Memory limit must be in format: NUMBER(KB|MB|GB)');
            }
        }

        return result;
    }

    /**
     * Returns a new configuration with optimized settings for the given environment
     * 
     * @param {string} environment - Target environment
     * @returns {DeploymentConfig} A new optimized configuration
     */
    optimize(environment) {
        const optimizedConfig = new DeploymentConfig(this.config);

        switch (environment) {
            case 'Browser':
                // Browser optimizations: reduce memory usage, worker count
                optimizedConfig.set('memoryLimit', '2GB');
                optimizedConfig.set('maxWorkers', 2);
                optimizedConfig.set('enableCompression', true);
                break;

            case 'Cloud':
                // Cloud optimizations: increase parallelization, metrics
                optimizedConfig.set('enableParallelization', true);
                optimizedConfig.set('maxWorkers', 8);
                optimizedConfig.set('metrics', {
                    collect: true,
                    endpoint: this.config.metrics.endpoint || 'auto'
                });
                break;

            case 'Node':
                // Node optimizations: balanced approach
                optimizedConfig.set('enableParallelization', true);
                optimizedConfig.set('maxWorkers', 4);
                break;

            default:
                // No specific optimizations
                break;
        }

        return optimizedConfig;
    }

    /**
     * Exports the configuration to a JSON object
     * 
     * @returns {Object} The configuration as a JSON object
     */
    toJSON() {
        return { ...this.config };
    }

    /**
     * Creates a configuration from a JSON object
     * 
     * @param {Object} json - The JSON object
     * @returns {DeploymentConfig} A new configuration instance
     */
    static fromJSON(json) {
        return new DeploymentConfig(json);
    }
} 