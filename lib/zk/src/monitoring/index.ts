/**
 * Monitoring System
 * 
 * Comprehensive monitoring and alerting system for tracking system health, performance metrics,
 * and critical events with advanced alerting capabilities.
 * 
 * Key features:
 * - Real-time performance metrics collection
 * - Threshold-based alerting
 * - Resource usage tracking
 * - Alert routing and escalation
 * - Multi-channel notifications
 * - Executive dashboard with key metrics
 * - Scheduled reporting
 */

// Export all monitoring components
export * from './SystemMonitor';
export * from './AlertManager';
export * from './ExecutiveDashboard';

// Export default singletons
import systemMonitor from './SystemMonitor';
import alertManager from './AlertManager';
import executiveDashboard from './ExecutiveDashboard';

// Export combined object
const monitoringSystem = {
  systemMonitor,
  alertManager,
  executiveDashboard,
  
  // Convenience method to initialize all components
  async initializeAll() {
    await systemMonitor.initialize();
    await alertManager.initialize();
    await executiveDashboard.initialize();
    return true;
  },
  
  // Convenience method to shut down all components
  shutdownAll() {
    systemMonitor.shutdown();
    alertManager.shutdown();
    executiveDashboard.shutdown();
  }
};

export default monitoringSystem;