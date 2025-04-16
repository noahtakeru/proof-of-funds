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

// Export specific types from each module to avoid conflicts
// SystemMonitor exports
export { 
  MetricType, 
  AlertSeverity, 
  systemMonitor 
} from './SystemMonitor';

// Export interfaces from SystemMonitor - these are all defined in the file
export type { 
  MetricDataPoint as Metric, 
  MetricDefinition, 
  AlertDefinition, 
  AlertEvent, 
  NotificationChannel
} from './SystemMonitor';

// AlertManager exports
export { 
  AlertStatus, 
  alertManager 
} from './AlertManager';

export type { 
  EscalationPolicy, 
  NotificationChannel as AlertManagerNotificationChannel,
  TrackedAlert 
} from './AlertManager';

// ExecutiveDashboard exports
export { 
  ReportFormat, 
  executiveDashboard 
} from './ExecutiveDashboard';

export type { 
  DashboardMetrics, 
  DashboardReport 
} from './ExecutiveDashboard';

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