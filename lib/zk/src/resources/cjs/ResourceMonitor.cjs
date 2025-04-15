"use strict";

class ResourceMonitor {
  constructor(config = {}) {
    this.config = {
      sampleInterval: 1000,
      enableBatteryMonitoring: false,
      enableNetworkMonitoring: false,
      thresholdNotifications: false,
      memoryThresholdPercent: 80,
      cpuThresholdPercent: 90,
      ...config
    };
    
    this.callbacks = new Map();
    this.lastSample = null;
    this.monitoringInterval = null;
    this.nextCallbackId = 1;
  }
  
  async sampleResources() {
    // Get memory info
    const memoryInfo = this.getMemoryInfo();
    
    // Get CPU info
    const cpuInfo = this.getCpuInfo();
    
    // Get storage info
    const storageInfo = this.getStorageInfo();
    
    // Get network info
    const networkInfo = this.config.enableNetworkMonitoring ? 
      await this.getNetworkInfo() : null;
    
    // Get battery info
    const batteryInfo = this.config.enableBatteryMonitoring ? 
      await this.getBatteryInfo() : null;
    
    // Create combined resource object
    const resources = {
      timestamp: Date.now(),
      memory: memoryInfo,
      cpu: cpuInfo,
      storage: storageInfo
    };
    
    if (networkInfo) {
      resources.network = networkInfo;
    }
    
    if (batteryInfo) {
      resources.battery = batteryInfo;
    }
    
    // Save as last sample
    this.lastSample = resources;
    
    return resources;
  }
  
  startContinuousMonitoring() {
    if (this.monitoringInterval) {
      // Already monitoring
      return;
    }
    
    this.monitoringInterval = setInterval(async () => {
      const resources = await this.sampleResources();
      this.checkThresholds(resources);
      this.notifyListeners(resources);
    }, this.config.sampleInterval);
  }
  
  stopContinuousMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
  
  registerCallback(callback) {
    const id = this.nextCallbackId++;
    this.callbacks.set(id, callback);
    return id;
  }
  
  unregisterCallback(id) {
    return this.callbacks.delete(id);
  }
  
  async notifyListeners(resources = null) {
    if (!resources) {
      resources = await this.sampleResources();
    }
    
    for (const callback of this.callbacks.values()) {
      try {
        callback(resources);
      } catch (error) {
        console.error('Error in resource monitor callback:', error);
      }
    }
  }
  
  checkThresholds(resources) {
    if (!this.config.thresholdNotifications) return;
    
    // Check memory threshold
    if (resources.memory && 
        resources.memory.usagePercent > this.config.memoryThresholdPercent) {
      this.notifyThresholdExceeded('memory', resources.memory.usagePercent);
    }
    
    // Check CPU threshold
    if (resources.cpu && 
        resources.cpu.usagePercent > this.config.cpuThresholdPercent) {
      this.notifyThresholdExceeded('cpu', resources.cpu.usagePercent);
    }
    
    // Check battery threshold
    if (resources.battery && 
        resources.battery.level < 20 && !resources.battery.charging) {
      this.notifyThresholdExceeded('battery', resources.battery.level);
    }
  }
  
  notifyThresholdExceeded(resourceType, value) {
    // In a real implementation, this would notify the application
    // For now, we'll just log it
    console.warn(`Resource threshold exceeded: ${resourceType} at ${value}`);
  }
  
  getMemoryInfo() {
    try {
      // Browser environment
      if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
        const perfMemory = window.performance.memory;
        return {
          total: perfMemory.jsHeapSizeLimit,
          used: perfMemory.usedJSHeapSize,
          usagePercent: (perfMemory.usedJSHeapSize / perfMemory.jsHeapSizeLimit) * 100
        };
      }
      
      // Node.js environment
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        // Estimate total memory - in a real implementation this would use os.totalmem()
        const totalMem = 8 * 1024 * 1024 * 1024; // Assume 8GB total memory
        return {
          total: totalMem,
          used: memUsage.rss,
          usagePercent: (memUsage.rss / totalMem) * 100,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal
        };
      }
      
      // Fallback for unknown environment
      return {
        total: 8 * 1024 * 1024 * 1024, // 8GB placeholder
        used: 2 * 1024 * 1024 * 1024,  // 2GB placeholder
        usagePercent: 25               // 25% placeholder
      };
    } catch (error) {
      console.error('Error getting memory info:', error);
      return null;
    }
  }
  
  getCpuInfo() {
    try {
      // Node.js with os module
      // In a real implementation, this would calculate CPU usage by sampling process.cpuUsage()
      // over time or using the os module
      
      // Simulate CPU info with reasonable values
      return {
        cores: 8, // Placeholder
        usage: 0.3, // 30% usage
        usagePercent: 30
      };
    } catch (error) {
      console.error('Error getting CPU info:', error);
      return null;
    }
  }
  
  getStorageInfo() {
    try {
      // In a real implementation, this would use browser's navigator.storage API
      // or Node.js fs.statfs to get actual storage information
      
      // Placeholder storage info
      return {
        total: 512 * 1024 * 1024 * 1024, // 512GB
        used: 128 * 1024 * 1024 * 1024,  // 128GB
        available: 384 * 1024 * 1024 * 1024, // 384GB
        usagePercent: 25 // 25%
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  }
  
  async getNetworkInfo() {
    try {
      // In a real implementation, this would track network usage
      // using PerformanceObserver for browser or monitoring network interfaces in Node.js
      
      // Placeholder network info
      return {
        online: true,
        currentBandwidth: 50000, // 50KB/s placeholder
        latency: 30, // 30ms placeholder
        connectionType: 'wifi' // placeholder
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      return null;
    }
  }
  
  async getBatteryInfo() {
    try {
      // Browser environment with Battery API
      if (typeof navigator !== 'undefined' && navigator.getBattery) {
        const battery = await navigator.getBattery();
        return {
          level: battery.level * 100, // Convert to percentage
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        };
      }
      
      // Node.js environment - battery info is not directly available
      // In a real implementation, platform-specific tools would be used
      
      // Fallback with placeholder data
      return null;
    } catch (error) {
      console.error('Error getting battery info:', error);
      return null;
    }
  }
  
  async getSystemLoad() {
    try {
      // In a real implementation, this would use os.loadavg() in Node.js
      // or estimate from CPU usage in browsers
      
      // Placeholder: Generate a reasonable load value between 0-1
      // with some basic memory and CPU consideration
      const memInfo = this.getMemoryInfo();
      const cpuInfo = this.getCpuInfo();
      
      const memFactor = memInfo ? (memInfo.usagePercent / 100) : 0.5;
      const cpuFactor = cpuInfo ? (cpuInfo.usagePercent / 100) : 0.5;
      
      // Weighted average with more weight on CPU
      const load = (memFactor * 0.4) + (cpuFactor * 0.6);
      return load;
    } catch (error) {
      console.error('Error getting system load:', error);
      return 0.5; // Fallback middle value
    }
  }
  
  getBatteryLevel() {
    if (this.lastSample && this.lastSample.battery) {
      return this.lastSample.battery.level;
    }
    
    // Placeholder - assume 80% battery if not available
    return 80;
  }
}

module.exports = { ResourceMonitor };