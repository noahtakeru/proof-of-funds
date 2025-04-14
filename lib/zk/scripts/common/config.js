/**
 * Configuration utility for ZK tests
 * Manages and validates test configurations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Default configuration values
const DEFAULT_CONFIG = {
    // Test execution settings
    tests: {
        performance: {
            enabled: true,
            iterations: 10,
            warmupIterations: 2,
            cooldownBetweenRuns: 1000, // ms
            timeout: 60000, // ms
            memoryProfile: true,
            concurrency: 4,
            batchSizes: [1, 10, 50, 100],
        },
        security: {
            enabled: true,
            iterations: 20,
            attackVectors: ['replay', 'malleability', 'parameterTampering', 'inputSpoofing'],
            strictMode: true,
        },
        regression: {
            enabled: true,
            failFast: true,
        }
    },

    // Output settings
    output: {
        directory: 'results',
        format: 'json',
        saveResults: true,
        generateHtmlReport: true,
        compareWithBaseline: true,
        baselineFile: 'baseline.json',
    },

    // Logging settings
    logging: {
        level: 'info',
        logToFile: true,
        logToConsole: true,
        logDirectory: 'logs',
        logFile: 'zk-tests.log',
        timeFormat: 'iso',
        useColors: true,
    },

    // Environment settings
    environment: {
        testNet: 'local',
        useRealWallets: false,
        gasLimit: 8000000,
        testTimeout: 300000, // ms
    }
};

/**
 * Utility to manage test configurations
 */
class ConfigManager {
    /**
     * Create a new ConfigManager instance
     * @param {Object} options - Configuration options
     * @param {string} options.configFile - Path to config file (relative or absolute)
     * @param {Object} options.overrides - Configuration overrides to apply
     */
    constructor(options = {}) {
        // If configFile is passed, add proper base path if relative
        this.configFile = options.configFile || null;
        if (this.configFile && !path.isAbsolute(this.configFile)) {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            this.configFile = path.resolve(__dirname, '../../', this.configFile);
        }

        // Start with default config
        this.config = { ...DEFAULT_CONFIG };

        // Load from file if provided
        if (this.configFile && fs.existsSync(this.configFile)) {
            this.loadFromFile(this.configFile);
        }

        // Apply any overrides
        if (options.overrides) {
            this.applyOverrides(options.overrides);
        }

        // Process and validate the config
        this.processConfig();
    }

    /**
     * Load configuration from a file
     * @param {string} filePath - Path to the configuration file
     */
    loadFromFile(filePath) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            let fileConfig;

            if (filePath.endsWith('.json')) {
                fileConfig = JSON.parse(fileContent);
            } else if (filePath.endsWith('.js')) {
                // For .js files, evaluate as module (less secure but more flexible)
                const tempFilePath = `${filePath}.temp.mjs`;
                fs.writeFileSync(tempFilePath, `export default ${fileContent}`);
                import(tempFilePath).then(module => {
                    fileConfig = module.default;
                    fs.unlinkSync(tempFilePath);
                }).catch(err => {
                    console.error(`Error importing JS config: ${err.message}`);
                    fs.unlinkSync(tempFilePath);
                });
            } else {
                throw new Error(`Unsupported config file format: ${filePath}`);
            }

            // Deep merge with current config
            this.config = this.deepMerge(this.config, fileConfig);
        } catch (err) {
            console.error(`Error loading config from ${filePath}: ${err.message}`);
        }
    }

    /**
     * Apply configuration overrides
     * @param {Object} overrides - Configuration overrides to apply
     */
    applyOverrides(overrides) {
        this.config = this.deepMerge(this.config, overrides);
    }

    /**
     * Validate and process the configuration
     */
    processConfig() {
        // Ensure output directory is absolute
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        if (!path.isAbsolute(this.config.output.directory)) {
            this.config.output.directory = path.resolve(__dirname, '../../', this.config.output.directory);
        }

        // Ensure log directory is absolute
        if (!path.isAbsolute(this.config.logging.logDirectory)) {
            this.config.logging.logDirectory = path.resolve(__dirname, '../../', this.config.logging.logDirectory);
        }

        // Validate log level
        const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];
        if (!validLogLevels.includes(this.config.logging.level.toLowerCase())) {
            console.warn(`Invalid log level '${this.config.logging.level}', defaulting to 'info'`);
            this.config.logging.level = 'info';
        }

        // Set full log file path
        if (this.config.logging.logFile) {
            this.config.logging.logFile = path.join(
                this.config.logging.logDirectory,
                this.config.logging.logFile
            );
        }

        // Set baseline file path if enabled
        if (this.config.output.compareWithBaseline && this.config.output.baselineFile) {
            if (!path.isAbsolute(this.config.output.baselineFile)) {
                this.config.output.baselineFile = path.join(
                    this.config.output.directory,
                    this.config.output.baselineFile
                );
            }
        }

        // Ensure test limits are reasonable
        this.config.tests.performance.iterations = Math.max(1, this.config.tests.performance.iterations);
        this.config.tests.performance.concurrency = Math.max(1, Math.min(
            this.config.tests.performance.concurrency,
            16 // Set a reasonable upper limit
        ));
    }

    /**
     * Deep merge two objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    deepMerge(target, source) {
        const result = { ...target };

        Object.keys(source).forEach(key => {
            if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
                result[key] = this.deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        });

        return result;
    }

    /**
     * Get the full configuration
     * @returns {Object} Complete configuration object
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get a specific configuration section
     * @param {string} section - Section to retrieve
     * @returns {Object} Configuration section
     */
    getSection(section) {
        return this.config[section] || {};
    }

    /**
     * Save the current configuration to a file
     * @param {string} filePath - Path to save the configuration to
     * @returns {boolean} Success status
     */
    saveToFile(filePath) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, JSON.stringify(this.config, null, 2), 'utf8');
            return true;
        } catch (err) {
            console.error(`Error saving config to ${filePath}: ${err.message}`);
            return false;
        }
    }

    /**
     * Create output and log directories if they don't exist
     */
    ensureDirectories() {
        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.config.output.directory)) {
            fs.mkdirSync(this.config.output.directory, { recursive: true });
        }

        // Create log directory if log to file is enabled
        if (this.config.logging.logToFile && !fs.existsSync(this.config.logging.logDirectory)) {
            fs.mkdirSync(this.config.logging.logDirectory, { recursive: true });
        }
    }
}

/**
 * Create a new config manager with default settings
 * @param {Object} options - Configuration options
 * @returns {ConfigManager} Config manager instance
 */
export function createConfigManager(options = {}) {
    return new ConfigManager(options);
}

// Create default config manager
const defaultConfigManager = new ConfigManager();

// Export the config manager and default config
export { ConfigManager, DEFAULT_CONFIG };
export default defaultConfigManager; 