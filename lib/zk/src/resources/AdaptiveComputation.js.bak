/**
 * AdaptiveComputation.js - JavaScript implementation of computation strategy adaptation
 * 
 * This module provides an intelligent system for adapting ZK computation strategies
 * based on system resource conditions. It supports multiple computation strategies
 * and automatically selects the most appropriate one based on available resources.
 * 
 * @module resources/AdaptiveComputation
 */

// Import dependencies
import { ResourceMonitor, ResourceType } from './ResourceMonitor.mjs';
import { ResourceAllocator } from './ResourceAllocator.js';
import { COMPUTATION_STRATEGIES } from './ComputationStrategies.mjs';
import { SystemError, errorLogger } from '../ErrorSystem.js';

/**
 * AdaptiveComputation - Selects and manages computational strategies based on available resources
 */
class AdaptiveComputation {
  /**
   * Create a new adaptive computation manager
   * 
   * @param {ResourceMonitor} resourceMonitor - Resource monitor instance
   * @param {ResourceAllocator} resourceAllocator - Resource allocator instance
   * @param {Object} options - Configuration options
   * @param {string[]} options.enabledStrategies - Array of enabled strategy names
   * @param {number} options.maxMemoryUsagePercent - Maximum memory usage percentage (0-100)
   * @param {number} options.maxCpuUsagePercent - Maximum CPU usage percentage (0-100)
   * @param {boolean} options.preferPerformance - Whether to prefer performance over resource usage
   * @param {Function} options.onStrategyChange - Callback when strategy changes
   */
  constructor(resourceMonitor, resourceAllocator, options = {}) {
    // Validate arguments
    if (!(resourceMonitor instanceof ResourceMonitor)) {
      throw new SystemError('Invalid ResourceMonitor instance provided', {
        code: 5002, // SYSTEM_CONFIGURATION_ERROR 
        recoverable: false,
        details: {
          expected: 'ResourceMonitor',
          received: typeof resourceMonitor
        }
      });
    }
    
    if (!(resourceAllocator instanceof ResourceAllocator)) {
      throw new SystemError('Invalid ResourceAllocator instance provided', {
        code: 5002, // SYSTEM_CONFIGURATION_ERROR
        recoverable: false,
        details: {
          expected: 'ResourceAllocator',
          received: typeof resourceAllocator
        }
      });
    }
    
    this.resourceMonitor = resourceMonitor;
    this.resourceAllocator = resourceAllocator;
    
    // Default options
    this.options = {
      enabledStrategies: Object.values(COMPUTATION_STRATEGIES),
      maxMemoryUsagePercent: 80,
      maxCpuUsagePercent: 85,
      preferPerformance: false,
      onStrategyChange: null,
      ...options
    };
    
    // Normalize percentage values to 0-100 range
    this.options.maxMemoryUsagePercent = Math.min(Math.max(this.options.maxMemoryUsagePercent, 0), 100);
    this.options.maxCpuUsagePercent = Math.min(Math.max(this.options.maxCpuUsagePercent, 0), 100);
    
    // Convert percentages to fractions (0-1)
    this.maxMemoryUsage = this.options.maxMemoryUsagePercent / 100;
    this.maxCpuUsage = this.options.maxCpuUsagePercent / 100;
    
    // Validate enabled strategies
    this.enabledStrategies = this.options.enabledStrategies.filter(
      strategy => Object.values(COMPUTATION_STRATEGIES).includes(strategy)
    );
    
    if (this.enabledStrategies.length === 0) {
      // Default to full computation if no valid strategies provided
      this.enabledStrategies = [COMPUTATION_STRATEGIES.FULL_COMPUTATION];
      
      errorLogger.warn('No valid computation strategies provided, using default', {
        context: 'AdaptiveComputation.constructor',
        defaultStrategy: COMPUTATION_STRATEGIES.FULL_COMPUTATION
      });
    }
    
    // Current active strategy
    this.currentStrategy = null;
    
    // Monitor resource changes
    this.resourceMonitor.onResourceChange(this._handleResourceChange.bind(this));
    
    // Initialize with the best strategy
    this._selectInitialStrategy();
  }
  
  /**
   * Select the most appropriate computation strategy based on current resources
   * 
   * @param {Object} operationContext - Additional context about the operation
   * @param {string} operationContext.operation - Operation name/identifier
   * @param {number} operationContext.priority - Operation priority (0-1)
   * @param {number} operationContext.complexity - Operation complexity (0-1)
   * @returns {Promise<string>} Selected computation strategy
   */
  async selectStrategy(operationContext = {}) {
    try {
      // Get current resource snapshot
      const snapshot = await this.resourceMonitor.sampleResources();
      
      // Get available resources for allocation
      const available = await this.resourceAllocator.getAvailableResources();
      
      // Check for resource constraints
      const memoryConstrained = 
        snapshot.resources[ResourceType.MEMORY]?.isConstrained || 
        available.memory < 0.2; // Less than 20% memory available
        
      const cpuConstrained = 
        snapshot.resources[ResourceType.CPU]?.isConstrained || 
        available.cpu < 0.2; // Less than 20% CPU available
      
      // Determine appropriate strategy based on constraints
      let selectedStrategy;
      
      if (memoryConstrained && cpuConstrained) {
        // Severe resource constraints - use fallback if available
        if (this.enabledStrategies.includes(COMPUTATION_STRATEGIES.FALLBACK_COMPUTATION)) {
          selectedStrategy = COMPUTATION_STRATEGIES.FALLBACK_COMPUTATION;
        } else if (this.enabledStrategies.includes(COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION)) {
          selectedStrategy = COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION;
        } else {
          // Default to first enabled strategy if no suitable alternative
          selectedStrategy = this.enabledStrategies[0];
        }
      } else if (memoryConstrained || cpuConstrained) {
        // Moderate resource constraints - use progressive computation if available
        if (this.enabledStrategies.includes(COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION)) {
          selectedStrategy = COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION;
        } else if (this.enabledStrategies.includes(COMPUTATION_STRATEGIES.FULL_COMPUTATION)) {
          selectedStrategy = COMPUTATION_STRATEGIES.FULL_COMPUTATION;
        } else {
          // Default to first enabled strategy if no suitable alternative
          selectedStrategy = this.enabledStrategies[0];
        }
      } else {
        // Sufficient resources - use full computation if available
        if (this.enabledStrategies.includes(COMPUTATION_STRATEGIES.FULL_COMPUTATION)) {
          selectedStrategy = COMPUTATION_STRATEGIES.FULL_COMPUTATION;
        } else {
          // Default to first enabled strategy if full computation not available
          selectedStrategy = this.enabledStrategies[0];
        }
      }
      
      // Override based on operation context if provided
      if (operationContext && operationContext.complexity !== undefined) {
        // For high complexity operations with limited resources, prefer more efficient strategies
        if (operationContext.complexity > 0.7 && (memoryConstrained || cpuConstrained)) {
          if (this.enabledStrategies.includes(COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION)) {
            selectedStrategy = COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION;
          }
        }
      }
      
      // Notify on strategy change if callback provided
      if (selectedStrategy !== this.currentStrategy && 
          typeof this.options.onStrategyChange === 'function') {
        this.options.onStrategyChange({
          previousStrategy: this.currentStrategy,
          newStrategy: selectedStrategy,
          resourceSnapshot: snapshot,
          availableResources: available,
          operationContext
        });
      }
      
      // Update current strategy
      this.currentStrategy = selectedStrategy;
      
      return selectedStrategy;
    } catch (error) {
      errorLogger.error('Failed to select computation strategy', {
        context: 'AdaptiveComputation.selectStrategy',
        operationContext,
        error
      });
      
      // Fall back to most conservative strategy on error
      if (this.enabledStrategies.includes(COMPUTATION_STRATEGIES.FALLBACK_COMPUTATION)) {
        return COMPUTATION_STRATEGIES.FALLBACK_COMPUTATION;
      }
      
      // If fallback not available, use whatever was previously selected or first enabled
      return this.currentStrategy || this.enabledStrategies[0];
    }
  }
  
  /**
   * Get the current computation strategy
   * 
   * @returns {string} Current computation strategy
   */
  getCurrentStrategy() {
    return this.currentStrategy;
  }
  
  /**
   * Update configuration options
   * 
   * @param {Object} options - New configuration options
   */
  updateOptions(options = {}) {
    // Merge new options with existing options
    this.options = {
      ...this.options,
      ...options
    };
    
    // Update derived values
    if (options.maxMemoryUsagePercent !== undefined) {
      this.options.maxMemoryUsagePercent = Math.min(Math.max(this.options.maxMemoryUsagePercent, 0), 100);
      this.maxMemoryUsage = this.options.maxMemoryUsagePercent / 100;
    }
    
    if (options.maxCpuUsagePercent !== undefined) {
      this.options.maxCpuUsagePercent = Math.min(Math.max(this.options.maxCpuUsagePercent, 0), 100);
      this.maxCpuUsage = this.options.maxCpuUsagePercent / 100;
    }
    
    // Update enabled strategies if provided
    if (options.enabledStrategies) {
      this.enabledStrategies = this.options.enabledStrategies.filter(
        strategy => Object.values(COMPUTATION_STRATEGIES).includes(strategy)
      );
      
      if (this.enabledStrategies.length === 0) {
        // Default to full computation if no valid strategies provided
        this.enabledStrategies = [COMPUTATION_STRATEGIES.FULL_COMPUTATION];
        
        errorLogger.warn('No valid computation strategies provided, using default', {
          context: 'AdaptiveComputation.updateOptions',
          defaultStrategy: COMPUTATION_STRATEGIES.FULL_COMPUTATION
        });
      }
      
      // Re-select appropriate strategy with new options
      this._selectInitialStrategy();
    }
  }
  
  /**
   * Get the computation strategies available for the given resource constraints
   * 
   * @param {Object} constraints - Resource constraints
   * @param {number} constraints.memory - Available memory (0-1)
   * @param {number} constraints.cpu - Available CPU (0-1)
   * @returns {string[]} Array of viable strategies sorted by preference
   */
  getViableStrategies(constraints = {}) {
    // Determine priority order based on preferences and constraints
    let priorityOrder;
    
    if (constraints.memory < 0.2 || constraints.cpu < 0.2) {
      // Severe constraints - prioritize minimal resource usage
      priorityOrder = [
        COMPUTATION_STRATEGIES.FALLBACK_COMPUTATION,
        COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION,
        COMPUTATION_STRATEGIES.FULL_COMPUTATION
      ];
    } else if (constraints.memory < 0.5 || constraints.cpu < 0.5) {
      // Moderate constraints - balance resource usage and performance
      priorityOrder = [
        COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION,
        COMPUTATION_STRATEGIES.FALLBACK_COMPUTATION,
        COMPUTATION_STRATEGIES.FULL_COMPUTATION
      ];
    } else {
      // Sufficient resources - prioritize performance
      priorityOrder = [
        COMPUTATION_STRATEGIES.FULL_COMPUTATION,
        COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION,
        COMPUTATION_STRATEGIES.FALLBACK_COMPUTATION
      ];
    }
    
    // Filter for enabled strategies and sort by priority
    return priorityOrder.filter(strategy => this.enabledStrategies.includes(strategy));
  }
  
  /**
   * Handle resource change events from the resource monitor
   * 
   * @param {Object} event - Resource change event
   * @private
   */
  _handleResourceChange(event) {
    // Only re-evaluate strategy if significant change or constraint change
    if (event.constraintChanged || 
        Math.abs(event.currentStats.currentUsage - (event.previousStats?.currentUsage || 0)) > 0.15) {
      this._selectInitialStrategy();
    }
  }
  
  /**
   * Select the initial most appropriate strategy
   * 
   * @private
   */
  async _selectInitialStrategy() {
    try {
      const strategy = await this.selectStrategy();
      
      errorLogger.info('Selected computation strategy', {
        context: 'AdaptiveComputation._selectInitialStrategy',
        strategy
      });
    } catch (error) {
      errorLogger.error('Failed to select initial strategy', {
        context: 'AdaptiveComputation._selectInitialStrategy',
        error
      });
      
      // Set default strategy on error
      this.currentStrategy = this.enabledStrategies[0];
    }
  }
}

export default AdaptiveComputation;