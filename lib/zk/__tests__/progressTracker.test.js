/**
 * Tests for progressTracker.js module
 */

// Import Jest from globals
import { jest } from '@jest/globals';

// Import module to test
import ProgressTracker from '../progressTracker.js';

describe('Progress Tracker', () => {
  describe('initialization', () => {
    it('should initialize with default values', () => {
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard'
      });
      
      expect(tracker.operationType).toBe('prove');
      expect(tracker.circuitType).toBe('standard');
      expect(tracker.totalSteps).toBe(100);
      expect(tracker.currentStep).toBe(0);
      expect(tracker.isComplete).toBe(false);
      expect(tracker.cancelled).toBe(false);
    });
    
    it('should initialize with custom steps', () => {
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        steps: 200
      });
      
      expect(tracker.totalSteps).toBe(200);
    });
    
    it('should initialize with progress callback', () => {
      const callback = jest.fn();
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        onProgressUpdate: callback
      });
      
      expect(tracker.onProgressUpdate).toBe(callback);
    });
  });
  
  describe('progress tracking', () => {
    it('should start tracking progress', () => {
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard'
      });
      
      // Mock Date.now() for consistent tests
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 1000);
      
      tracker.start();
      
      expect(tracker.startTime).toBe(1000);
      expect(tracker.lastUpdateTime).toBe(1000);
      expect(tracker.currentStep).toBe(0);
      expect(tracker.isComplete).toBe(false);
      
      // Restore Date.now()
      Date.now = originalDateNow;
    });
    
    it('should update progress by percentage', () => {
      const callback = jest.fn();
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        onProgressUpdate: callback,
        steps: 100
      });
      
      // Mock Date.now() for consistent tests
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 1000);
      
      tracker.start();
      
      // Update to 50%
      Date.now = jest.fn(() => 2000);
      tracker.updateProgress(50);
      
      expect(tracker.currentStep).toBe(50);
      expect(callback).toHaveBeenCalledTimes(2); // Once for start, once for update
      
      const lastCallArgs = callback.mock.calls[1][0];
      expect(lastCallArgs.percentage).toBe(50);
      expect(lastCallArgs.step).toBe(50);
      expect(lastCallArgs.elapsed).toBe(1000); // 2000 - 1000
      
      // Restore Date.now()
      Date.now = originalDateNow;
    });
    
    it('should advance progress by steps', () => {
      const callback = jest.fn();
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        onProgressUpdate: callback,
        steps: 100
      });
      
      // Mock Date.now() for consistent tests
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 1000);
      
      tracker.start();
      
      // Advance by 25 steps
      Date.now = jest.fn(() => 2000);
      tracker.advanceSteps(25);
      
      expect(tracker.currentStep).toBe(25);
      expect(callback).toHaveBeenCalledTimes(2); // Once for start, once for update
      
      const lastCallArgs = callback.mock.calls[1][0];
      expect(lastCallArgs.percentage).toBe(25);
      expect(lastCallArgs.step).toBe(25);
      
      // Restore Date.now()
      Date.now = originalDateNow;
    });
    
    it('should complete tracking progress', () => {
      const callback = jest.fn();
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        onProgressUpdate: callback,
        steps: 100
      });
      
      // Mock Date.now() for consistent tests
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 1000);
      
      tracker.start();
      
      // Update to 50%
      Date.now = jest.fn(() => 2000);
      tracker.updateProgress(50);
      
      // Complete tracking
      Date.now = jest.fn(() => 3000);
      tracker.complete();
      
      expect(tracker.currentStep).toBe(100);
      expect(tracker.isComplete).toBe(true);
      expect(callback).toHaveBeenCalledTimes(3); // Start, update, complete
      
      const lastCallArgs = callback.mock.calls[2][0];
      expect(lastCallArgs.percentage).toBe(100);
      expect(lastCallArgs.step).toBe(100);
      expect(lastCallArgs.isComplete).toBe(true);
      expect(lastCallArgs.estimatedTimeRemaining).toBe(0);
      
      // Restore Date.now()
      Date.now = originalDateNow;
    });
    
    it('should calculate estimated time remaining', () => {
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        steps: 100
      });
      
      // Mock Date.now() for consistent tests
      const originalDateNow = Date.now;
      
      // Start at time 1000
      Date.now = jest.fn(() => 1000);
      tracker.start();
      
      // Update to 25% at time 2000 (1000ms elapsed)
      Date.now = jest.fn(() => 2000);
      tracker.updateProgress(25);
      
      // At 25% progress with 1000ms elapsed, estimated total is 4000ms
      // So remaining time should be 4000 - 1000 = 3000ms
      expect(tracker._calculateEstimatedTimeRemaining()).toBe(3000);
      
      // Update to 50% at time 3000 (2000ms elapsed)
      Date.now = jest.fn(() => 3000);
      tracker.updateProgress(50);
      
      // At 50% progress with 2000ms elapsed, estimated total is 4000ms
      // So remaining time should be 4000 - 2000 = 2000ms
      expect(tracker._calculateEstimatedTimeRemaining()).toBe(2000);
      
      // Restore Date.now()
      Date.now = originalDateNow;
    });
  });
  
  describe('cancellation', () => {
    it('should cancel tracking progress', () => {
      const callback = jest.fn();
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        onProgressUpdate: callback
      });
      
      tracker.start();
      tracker.cancel();
      
      expect(tracker.cancelled).toBe(true);
      expect(callback).toHaveBeenCalledTimes(2); // Once for start, once for cancel
      
      const lastCallArgs = callback.mock.calls[1][0];
      expect(lastCallArgs.isCancelled).toBe(true);
    });
    
    it('should cancel with error message', () => {
      const callback = jest.fn();
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        onProgressUpdate: callback
      });
      
      tracker.start();
      const error = new Error('Operation failed');
      tracker.cancel(error);
      
      expect(tracker.cancelled).toBe(true);
      expect(tracker.error).toBe(error);
      
      const lastCallArgs = callback.mock.calls[1][0];
      expect(lastCallArgs.isCancelled).toBe(true);
      expect(lastCallArgs.error).toBe(error);
    });
    
    it('should respect abort signal', () => {
      // Create an AbortController and get its signal
      const controller = new AbortController();
      const signal = controller.signal;
      
      const callback = jest.fn();
      const tracker = new ProgressTracker({
        operationType: 'prove',
        circuitType: 'standard',
        onProgressUpdate: callback,
        abortSignal: signal
      });
      
      tracker.start();
      
      // Abort the operation
      controller.abort();
      
      expect(tracker.isCancelled()).toBe(true);
      expect(callback).toHaveBeenCalledTimes(2); // Once for start, once for cancel
      
      const lastCallArgs = callback.mock.calls[1][0];
      expect(lastCallArgs.isCancelled).toBe(true);
    });
  });
  
  describe('static registry', () => {
    beforeEach(() => {
      // Clear active trackers before each test
      ProgressTracker.activeTrackers = {};
    });
    
    it('should create and retrieve tracker by ID', () => {
      const tracker = ProgressTracker.create('test-operation', {
        operationType: 'prove',
        circuitType: 'standard'
      });
      
      expect(tracker).toBeInstanceOf(ProgressTracker);
      expect(ProgressTracker.get('test-operation')).toBe(tracker);
    });
    
    it('should remove tracker by ID', () => {
      ProgressTracker.create('test-operation', {
        operationType: 'prove',
        circuitType: 'standard'
      });
      
      ProgressTracker.remove('test-operation');
      
      expect(ProgressTracker.get('test-operation')).toBeNull();
    });
    
    it('should replace existing tracker with same ID', () => {
      const tracker1 = ProgressTracker.create('test-operation', {
        operationType: 'prove',
        circuitType: 'standard'
      });
      
      const tracker2 = ProgressTracker.create('test-operation', {
        operationType: 'verify',
        circuitType: 'threshold'
      });
      
      // Should be a different instance
      expect(tracker2).not.toBe(tracker1);
      
      // First tracker should be cancelled
      expect(tracker1.cancelled).toBe(true);
      
      // Registry should contain the second tracker
      expect(ProgressTracker.get('test-operation')).toBe(tracker2);
      expect(ProgressTracker.get('test-operation').operationType).toBe('verify');
    });
  });
});