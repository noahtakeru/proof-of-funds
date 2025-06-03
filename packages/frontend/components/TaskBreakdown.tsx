/**
 * Zero-Knowledge Proof Task Breakdown Component
 * 
 * This component visualizes the individual tasks and operations that occur during
 * ZK proof generation and verification, providing a detailed view of the complex
 * computational process.
 * 
 * Features:
 * - Breakdown of complex proof operations into discrete steps
 * - Visual representation of task dependencies and relationships
 * - Resource usage and performance metrics for each task
 * - Collapsible sections for handling complex operation hierarchies
 * 
 * @param {Object} props - Component properties
 * @param {Object[]} props.tasks - Array of task objects with name, status, and metrics
 * @param {string} props.proofType - Type of proof (standard, threshold, maximum)
 * @param {boolean} props.showDetailedMetrics - Whether to show detailed performance metrics
 * @param {Function} props.onTaskClick - Callback when a task is clicked for more details
 */

import React, { useState } from 'react';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'error' | 'canceled';

export interface TaskMetrics {
  cpuUsage?: number; // percentage
  memoryUsage?: number; // in MB
  executionTime?: number; // in milliseconds
  constraintCount?: number; // for circuit tasks
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  progress?: number; // 0-100
  startTime?: Date;
  endTime?: Date;
  metrics?: TaskMetrics;
  subtasks?: Task[];
  dependencies?: string[]; // IDs of tasks this task depends on
  errorMessage?: string;
}

interface TaskBreakdownProps {
  tasks: Task[];
  proofType: 'standard' | 'threshold' | 'maximum';
  showDetailedMetrics?: boolean;
  onTaskClick?: (taskId: string) => void;
}

const TaskBreakdown: React.FC<TaskBreakdownProps> = ({
  tasks,
  proofType,
  showDetailedMetrics = false,
  onTaskClick
}) => {
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Toggle task expansion
  const toggleTaskExpansion = (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  // Handle task click
  const handleTaskClick = (taskId: string) => {
    if (onTaskClick) {
      onTaskClick(taskId);
    }
  };

  // Format execution time in a human-readable way
  const formatExecutionTime = (timeMs?: number): string => {
    if (timeMs === undefined) {return 'N/A';}
    
    if (timeMs < 1000) {return `${timeMs}ms`;}
    if (timeMs < 60000) {return `${(timeMs / 1000).toFixed(2)}s`;}
    
    const minutes = Math.floor(timeMs / 60000);
    const seconds = ((timeMs % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  };

  // Get status color and icon
  const getStatusDisplay = (status: TaskStatus): { color: string; icon: JSX.Element } => {
    switch (status) {
      case 'completed':
        return {
          color: 'text-green-500',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )
        };
      case 'running':
        return {
          color: 'text-blue-500',
          icon: (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )
        };
      case 'error':
        return {
          color: 'text-red-500',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )
        };
      case 'canceled':
        return {
          color: 'text-yellow-500',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          )
        };
      default:
        return {
          color: 'text-gray-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
    }
  };

  // Recursively render a task and its subtasks
  const renderTask = (task: Task, depth: number = 0): JSX.Element => {
    const { color, icon } = getStatusDisplay(task.status);
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTasks[task.id] || false;
    
    return (
      <div key={task.id} className="mb-2">
        <div 
          className={`flex items-start py-2 px-3 rounded-md ${task.status === 'running' ? 'bg-blue-50' : 'hover:bg-gray-50'} cursor-pointer`}
          onClick={() => handleTaskClick(task.id)}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          <div className={`flex-shrink-0 ${color} mr-2 mt-0.5`}>
            {icon}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h4 className="text-sm font-medium text-gray-800">{task.name}</h4>
                {hasSubtasks && (
                  <button
                    onClick={(e) => toggleTaskExpansion(task.id, e)}
                    className="ml-2 text-gray-500 hover:text-gray-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
              
              {task.status === 'completed' && task.metrics?.executionTime !== undefined && (
                <span className="text-xs text-gray-500">
                  {formatExecutionTime(task.metrics.executionTime)}
                </span>
              )}
            </div>
            
            {task.description && (
              <p className="text-xs text-gray-500 mt-1">{task.description}</p>
            )}
            
            {task.status === 'running' && task.progress !== undefined && (
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
                />
              </div>
            )}
            
            {task.status === 'error' && task.errorMessage && (
              <p className="text-xs text-red-600 mt-1">{task.errorMessage}</p>
            )}
            
            {/* Detailed metrics */}
            {showDetailedMetrics && task.metrics && (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {task.metrics.cpuUsage !== undefined && (
                  <div>
                    <span className="text-gray-500">CPU: </span>
                    <span className="font-medium">{task.metrics.cpuUsage.toFixed(1)}%</span>
                  </div>
                )}
                {task.metrics.memoryUsage !== undefined && (
                  <div>
                    <span className="text-gray-500">Memory: </span>
                    <span className="font-medium">{task.metrics.memoryUsage.toFixed(1)} MB</span>
                  </div>
                )}
                {task.metrics.constraintCount !== undefined && (
                  <div>
                    <span className="text-gray-500">Constraints: </span>
                    <span className="font-medium">{task.metrics.constraintCount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Render subtasks if expanded */}
        {hasSubtasks && isExpanded && (
          <div className="mt-1 ml-5 pl-2 border-l border-gray-200">
            {task.subtasks!.map(subtask => renderTask(subtask, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 my-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-800">
          {proofType.charAt(0).toUpperCase() + proofType.slice(1)} Proof Task Breakdown
        </h3>
        
        <div className="flex items-center space-x-3">
          <div className="text-xs px-2 py-0.5 bg-zk-light text-zk rounded">
            ZK Circuit
          </div>
          
          <button
            onClick={() => setExpandedTasks(tasks.reduce((acc, task) => ({ ...acc, [task.id]: true }), {}))}
            className="text-xs text-gray-600 hover:text-gray-800"
          >
            Expand All
          </button>
          
          <button
            onClick={() => setExpandedTasks({})}
            className="text-xs text-gray-600 hover:text-gray-800"
          >
            Collapse All
          </button>
        </div>
      </div>
      
      <div className="space-y-1">
        {tasks.map(task => renderTask(task))}
      </div>
      
      {tasks.length === 0 && (
        <div className="py-4 text-center text-sm text-gray-500">
          No tasks to display
        </div>
      )}
      
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <div>
            Total Tasks: {tasks.reduce((count, task) => count + 1 + (task.subtasks?.length || 0), 0)}
          </div>
          
          <div>
            Completed: {tasks.reduce((count, task) => {
              const completedSubtasks = task.subtasks?.filter(st => st.status === 'completed').length || 0;
              return count + (task.status === 'completed' ? 1 : 0) + completedSubtasks;
            }, 0)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskBreakdown;