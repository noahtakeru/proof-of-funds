/**
 * @fileoverview Platform adapter factory for cross-platform deployment
 * 
 * This module provides a factory for creating environment-specific platform adapters
 * that abstract away differences between platforms (browser, Node.js, mobile, etc.)
 */

import { EnvironmentType } from './DeploymentConfig';
import { EnvironmentDetector } from './EnvironmentDetector';

/**
 * Common interface for all platform adapters
 */
export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: EnvironmentType;

  /** Initialize the platform adapter */
  initialize(): Promise<boolean>;

  /** Check if a specific feature is supported by the platform */
  supportsFeature(featureName: string): boolean;

  /** Get platform-specific implementation of a component */
  getImplementation<T>(componentName: string): T;

  /** Execute platform-specific optimization strategies */
  optimizeForPlatform(): Promise<void>;

  /** Clean up resources used by the platform adapter */
  cleanup(): Promise<void>;
}

/**
 * Factory for creating platform-specific adapters
 */
export class PlatformAdapterFactory {
  private static instance: PlatformAdapterFactory;
  private detector: EnvironmentDetector;
  private adapters: Map<EnvironmentType, PlatformAdapter>;

  private constructor() {
    this.detector = new EnvironmentDetector();
    this.adapters = new Map();
  }

  /**
   * Get the singleton instance of the factory
   */
  public static getInstance(): PlatformAdapterFactory {
    if (!PlatformAdapterFactory.instance) {
      PlatformAdapterFactory.instance = new PlatformAdapterFactory();
    }
    return PlatformAdapterFactory.instance;
  }

  /**
   * Create adapter for the current platform
   */
  public static createForCurrentPlatform(): any {
    const adapter = new (require('./DeploymentAdapter').DeploymentAdapter)();
    return adapter;
  }

  /**
   * Create adapter for a specific platform
   */
  public static createForPlatform(platform: EnvironmentType): any {
    const adapter = new (require('./DeploymentAdapter').DeploymentAdapter)();
    (adapter as any).environment = platform;
    return adapter;
  }

  /**
   * Create adapter with a custom configuration
   */
  public static createWithConfiguration(config: any): any {
    return new (require('./DeploymentAdapter').DeploymentAdapter)(config);
  }

  /**
   * Create or retrieve a platform adapter for the current environment
   */
  public getPlatformAdapter(): PlatformAdapter {
    const environment = this.detector.detectEnvironment();

    // Return cached adapter if available
    if (this.adapters.has(environment)) {
      return this.adapters.get(environment)!;
    }

    // Create appropriate adapter for the detected environment
    let adapter: PlatformAdapter;

    switch (environment) {
      case EnvironmentType.Browser:
        adapter = new BrowserPlatformAdapter();
        break;
      case EnvironmentType.Node:
        adapter = new NodePlatformAdapter();
        break;
      case EnvironmentType.Mobile:
        adapter = new MobilePlatformAdapter();
        break;
      case EnvironmentType.Worker:
        adapter = new WorkerPlatformAdapter();
        break;
      default:
        adapter = new FallbackPlatformAdapter();
    }

    // Cache the adapter for future use
    this.adapters.set(environment, adapter);

    return adapter;
  }

  /**
   * Create a specific platform adapter (useful for testing)
   */
  public createAdapter(environment: EnvironmentType): PlatformAdapter {
    switch (environment) {
      case EnvironmentType.Browser:
        return new BrowserPlatformAdapter();
      case EnvironmentType.Node:
        return new NodePlatformAdapter();
      case EnvironmentType.Mobile:
        return new MobilePlatformAdapter();
      case EnvironmentType.Worker:
        return new WorkerPlatformAdapter();
      default:
        return new FallbackPlatformAdapter();
    }
  }
}

/**
 * Base implementation of platform adapter with common functionality
 */
abstract class BasePlatformAdapter implements PlatformAdapter {
  public abstract readonly platform: EnvironmentType;
  protected features: Map<string, boolean> = new Map();
  protected implementations: Map<string, any> = new Map();
  protected initialized: boolean = false;

  /**
   * Initialize the platform adapter
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      await this.detectFeatures();
      await this.registerImplementations();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`Failed to initialize ${this.platform} adapter:`, error);
      return false;
    }
  }

  /**
   * Check if a specific feature is supported
   */
  public supportsFeature(featureName: string): boolean {
    return this.features.get(featureName) === true;
  }

  /**
   * Get platform-specific implementation of a component
   */
  public getImplementation<T>(componentName: string): T {
    const implementation = this.implementations.get(componentName);

    if (!implementation) {
      throw new Error(`Implementation for '${componentName}' not found in ${this.platform} adapter`);
    }

    return implementation as T;
  }

  /**
   * Execute platform-specific optimization strategies
   */
  public async optimizeForPlatform(): Promise<void> {
    // Base implementation does nothing
    // Subclasses should override this method
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    // Base implementation does nothing
    // Subclasses should override this method
  }

  /**
   * Detect features available on this platform
   */
  protected abstract detectFeatures(): Promise<void>;

  /**
   * Register platform-specific implementations
   */
  protected abstract registerImplementations(): Promise<void>;
}

/**
 * Browser-specific platform adapter
 */
class BrowserPlatformAdapter extends BasePlatformAdapter {
  public readonly platform = EnvironmentType.Browser;

  /**
   * Detect browser-specific features
   */
  protected async detectFeatures(): Promise<void> {
    this.features.set('webWorkers', typeof Worker !== 'undefined');
    this.features.set('webAssembly', typeof WebAssembly !== 'undefined');
    this.features.set('indexedDB', typeof indexedDB !== 'undefined');
    this.features.set('serviceWorker', 'serviceWorker' in navigator);
    this.features.set('sharedArrayBuffer', this.detectSharedArrayBuffer());
    this.features.set('secureContext', window.isSecureContext === true);
    this.features.set('localStorage', this.detectLocalStorage());
    this.features.set('offlineDetection', 'onLine' in navigator);
    this.features.set('webCrypto', typeof window.crypto !== 'undefined' && typeof window.crypto.subtle !== 'undefined');
    this.features.set('webGL', this.detectWebGL());
  }

  /**
   * Register browser-specific implementations
   */
  protected async registerImplementations(): Promise<void> {
    // Register browser-specific storage implementation
    if (this.supportsFeature('indexedDB')) {
      this.implementations.set('storage', {
        // Browser storage implementation will go here
        async store(key: string, value: any): Promise<void> {
          if (typeof value === 'object') {
            localStorage.setItem(key, JSON.stringify(value));
          } else {
            localStorage.setItem(key, String(value));
          }
        },
        async retrieve(key: string): Promise<any> {
          const value = localStorage.getItem(key);
          try {
            return value ? JSON.parse(value) : null;
          } catch {
            return value;
          }
        },
        async remove(key: string): Promise<void> {
          localStorage.removeItem(key);
        }
      });
    }

    // Register browser-specific threading implementation
    if (this.supportsFeature('webWorkers')) {
      this.implementations.set('threading', {
        // Browser threading implementation will go here
        async spawnWorker(scriptUrl: string, data: any): Promise<any> {
          return new Promise((resolve, reject) => {
            const worker = new Worker(scriptUrl);
            worker.onmessage = (e) => resolve(e.data);
            worker.onerror = (e) => reject(e);
            worker.postMessage(data);
          });
        }
      });
    }

    // Register browser-specific crypto implementation
    if (this.supportsFeature('webCrypto')) {
      this.implementations.set('crypto', {
        // Browser crypto implementation will go here
        async generateRandomBytes(length: number): Promise<Uint8Array> {
          const array = new Uint8Array(length);
          window.crypto.getRandomValues(array);
          return array;
        }
      });
    }
  }

  /**
   * Execute browser-specific optimizations
   */
  public async optimizeForPlatform(): Promise<void> {
    // Optimize rendering if needed
    if (typeof document !== 'undefined' && document.hidden) {
      // Document not visible, can reduce rendering work
    }

    // Check network conditions
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn && conn.saveData) {
        // User has requested reduced data usage
        // Implement data-saving strategies
      }

      if (conn && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
        // Very slow connection, optimize accordingly
      }
    }
  }

  /**
   * Detect SharedArrayBuffer support
   */
  private detectSharedArrayBuffer(): boolean {
    try {
      // Check both existence and usability
      if (typeof SharedArrayBuffer !== 'undefined') {
        new SharedArrayBuffer(1); // Will throw if SAB is not actually available
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detect localStorage support
   */
  private detectLocalStorage(): boolean {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      const result = localStorage.getItem(testKey) === testKey;
      localStorage.removeItem(testKey);
      return result;
    } catch {
      return false;
    }
  }

  /**
   * Detect WebGL support
   */
  private detectWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) ||
        (canvas.getContext('webgl2') || canvas.getContext('experimental-webgl2'))
      );
    } catch {
      return false;
    }
  }
}

/**
 * Node.js-specific platform adapter
 */
class NodePlatformAdapter extends BasePlatformAdapter {
  public readonly platform = EnvironmentType.Node;

  /**
   * Detect Node.js-specific features
   */
  protected async detectFeatures(): Promise<void> {
    this.features.set('webWorkers', false);
    this.features.set('webAssembly', typeof WebAssembly !== 'undefined');
    this.features.set('indexedDB', false);
    this.features.set('serviceWorker', false);
    this.features.set('sharedArrayBuffer', typeof SharedArrayBuffer !== 'undefined');
    this.features.set('secureContext', true);
    this.features.set('localStorage', false);
    this.features.set('fileSystem', true);
    this.features.set('workerThreads', this.detectWorkerThreads());
    this.features.set('nodeCrypto', this.detectNodeCrypto());
  }

  /**
   * Register Node.js-specific implementations
   */
  protected async registerImplementations(): Promise<void> {
    // Register Node.js-specific storage implementation
    this.implementations.set('storage', {
      // Node.js storage implementation will go here
      // This would use the fs module in a real implementation
      async store(key: string, value: any): Promise<void> {
        // Simplified implementation for example
        const fs = require('fs').promises;
        const path = require('path');
        const filePath = path.join(process.cwd(), '.cache', key);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(value));
      },
      async retrieve(key: string): Promise<any> {
        try {
          const fs = require('fs').promises;
          const path = require('path');
          const filePath = path.join(process.cwd(), '.cache', key);
          const data = await fs.readFile(filePath, 'utf8');
          return JSON.parse(data);
        } catch {
          return null;
        }
      },
      async remove(key: string): Promise<void> {
        try {
          const fs = require('fs').promises;
          const path = require('path');
          const filePath = path.join(process.cwd(), '.cache', key);
          await fs.unlink(filePath);
        } catch {
          // Ignore errors if file doesn't exist
        }
      }
    });

    // Register Node.js-specific threading implementation
    if (this.supportsFeature('workerThreads')) {
      this.implementations.set('threading', {
        // Node.js threading implementation will go here
        async spawnWorker(scriptPath: string, data: any): Promise<any> {
          return new Promise((resolve, reject) => {
            const { Worker } = require('worker_threads');
            const worker = new Worker(scriptPath, { workerData: data });
            worker.on('message', resolve);
            worker.on('error', reject);
          });
        }
      });
    }

    // Register Node.js-specific crypto implementation
    if (this.supportsFeature('nodeCrypto')) {
      this.implementations.set('crypto', {
        // Node.js crypto implementation will go here
        async generateRandomBytes(length: number): Promise<Uint8Array> {
          const crypto = require('crypto');
          return crypto.randomBytes(length);
        }
      });
    }
  }

  /**
   * Execute Node.js-specific optimizations
   */
  public async optimizeForPlatform(): Promise<void> {
    // Node.js specific optimizations
    // Example: Adjust memory limits based on available system memory
    try {
      const os = require('os');
      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      if (freeMem < totalMem * 0.2) {
        // System is low on memory, reduce memory usage
        // Implement memory conservation strategies
      }
    } catch {
      // Ignore errors if os module is unavailable
    }
  }

  /**
   * Detect worker_threads support
   */
  private detectWorkerThreads(): boolean {
    try {
      require('worker_threads');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect crypto module support
   */
  private detectNodeCrypto(): boolean {
    try {
      require('crypto');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Mobile-specific platform adapter
 */
class MobilePlatformAdapter extends BasePlatformAdapter {
  public readonly platform = EnvironmentType.Mobile;

  /**
   * Detect mobile-specific features
   */
  protected async detectFeatures(): Promise<void> {
    // Mobile environments can vary significantly, so we start with browser detection
    // and then add mobile-specific features
    const browserDetector = new BrowserPlatformAdapter();
    await browserDetector.initialize();

    // Copy browser features
    for (const [key, value] of (browserDetector as any).features.entries()) {
      this.features.set(key, value);
    }

    // Add mobile-specific features
    this.features.set('batteryAPI', this.detectBatteryAPI());
    this.features.set('vibration', typeof navigator !== 'undefined' && 'vibrate' in navigator);
    this.features.set('touch', typeof navigator !== 'undefined' && ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0));
    this.features.set('deviceOrientation', typeof window !== 'undefined' && 'DeviceOrientationEvent' in window);
    this.features.set('reactNative', typeof navigator !== 'undefined' && navigator.product === 'ReactNative');
  }

  /**
   * Register mobile-specific implementations
   */
  protected async registerImplementations(): Promise<void> {
    // Mobile environments typically extend browser implementations
    const browserAdapter = new BrowserPlatformAdapter();
    await browserAdapter.initialize();

    // Copy browser implementations
    for (const [key, value] of (browserAdapter as any).implementations.entries()) {
      this.implementations.set(key, value);
    }

    // Add or override with mobile-specific implementations

    // Register mobile-specific battery-aware implementation
    if (this.supportsFeature('batteryAPI')) {
      this.implementations.set('powerManagement', {
        // Mobile power management implementation
        async getBatteryStatus(): Promise<{ level: number, charging: boolean }> {
          try {
            // @ts-ignore - navigator.getBattery() is not in all TypeScript definitions
            const battery = await navigator.getBattery();
            return {
              level: battery.level,
              charging: battery.charging
            };
          } catch {
            return { level: 1, charging: true }; // Default to full battery if API unavailable
          }
        },

        async optimizeForBatteryLevel(): Promise<void> {
          try {
            // @ts-ignore - navigator.getBattery() is not in all TypeScript definitions
            const battery = await navigator.getBattery();
            if (battery.level < 0.2 && !battery.charging) {
              // Battery is low, implement power saving strategies
              // For example, reduce computation intensity
            }
          } catch {
            // Battery API not available, can't optimize
          }
        }
      });
    }

    // Register mobile-specific networking implementation
    this.implementations.set('networking', {
      // Mobile networking implementation with awareness of data limits
      async fetchWithDataSaving(url: string, options?: RequestInit): Promise<Response> {
        // Check if the user is on a metered connection
        const isMetered = this.isMeteredConnection();

        if (isMetered) {
          // On metered connection, implement data-saving strategies
          // For example, reduce quality or use compression
          if (!options) options = {};
          if (!options.headers) options.headers = {};

          // Add header to request lower quality data if supported by the server
          (options.headers as any)['Save-Data'] = 'on';
        }

        return fetch(url, options);
      },

      isMeteredConnection(): boolean {
        if (typeof navigator !== 'undefined' &&
          'connection' in navigator &&
          (navigator as any).connection &&
          (navigator as any).connection.metered !== undefined) {
          return (navigator as any).connection.metered;
        }
        return false; // Unknown if metered
      }
    });
  }

  /**
   * Execute mobile-specific optimizations
   */
  public async optimizeForPlatform(): Promise<void> {
    // Implement mobile-specific optimizations

    // Check battery status and optimize accordingly
    if (this.supportsFeature('batteryAPI')) {
      const powerManagement = this.getImplementation<any>('powerManagement');
      await powerManagement.optimizeForBatteryLevel();
    }

    // Check for low memory conditions
    if (typeof performance !== 'undefined' &&
      (performance as any).memory &&
      (performance as any).memory.usedJSHeapSize > 0.8 * (performance as any).memory.jsHeapSizeLimit) {
      // Memory pressure detected, implement memory-saving strategies
    }
  }

  /**
   * Detect Battery API support
   */
  private detectBatteryAPI(): boolean {
    return typeof navigator !== 'undefined' && 'getBattery' in navigator;
  }
}

/**
 * Web Worker-specific platform adapter
 */
class WorkerPlatformAdapter extends BasePlatformAdapter {
  public readonly platform = EnvironmentType.Worker;

  /**
   * Detect Web Worker-specific features
   */
  protected async detectFeatures(): Promise<void> {
    this.features.set('webWorkers', false); // Cannot create workers from within a worker
    this.features.set('webAssembly', typeof WebAssembly !== 'undefined');
    this.features.set('indexedDB', typeof indexedDB !== 'undefined');
    this.features.set('serviceWorker', false);
    this.features.set('sharedArrayBuffer', typeof SharedArrayBuffer !== 'undefined');
    this.features.set('secureContext', true); // Workers inherit secure context from their creator
    this.features.set('localStorage', false);
    this.features.set('transferableObjects', true);
    // Check if this is a worker context - we can't directly access importScripts in TypeScript
    this.features.set('workboxAvailable', typeof self !== 'undefined' &&
      typeof window === 'undefined' &&
      self.constructor &&
      self.constructor.name === 'DedicatedWorkerGlobalScope');
  }

  /**
   * Register Web Worker-specific implementations
   */
  protected async registerImplementations(): Promise<void> {
    // Register worker-specific communication implementation
    this.implementations.set('communication', {
      // Worker communication implementation
      sendMessage(message: any): void {
        self.postMessage(message);
      },

      onMessage(callback: (message: any) => void): void {
        self.onmessage = (e) => callback(e.data);
      }
    });

    // Register worker-specific storage implementation
    if (this.supportsFeature('indexedDB')) {
      this.implementations.set('storage', {
        // IndexedDB-based storage implementation
        async store(key: string, value: any): Promise<void> {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('worker-cache', 1);

            request.onupgradeneeded = () => {
              const db = request.result;
              if (!db.objectStoreNames.contains('keyval')) {
                db.createObjectStore('keyval');
              }
            };

            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction('keyval', 'readwrite');
              const store = tx.objectStore('keyval');
              store.put(value, key);

              tx.oncomplete = () => {
                db.close();
                resolve();
              };

              tx.onerror = () => {
                db.close();
                reject(new Error('Failed to store data'));
              };
            };

            request.onerror = () => reject(request.error);
          });
        },

        async retrieve(key: string): Promise<any> {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('worker-cache', 1);

            request.onupgradeneeded = () => {
              const db = request.result;
              if (!db.objectStoreNames.contains('keyval')) {
                db.createObjectStore('keyval');
              }
            };

            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction('keyval', 'readonly');
              const store = tx.objectStore('keyval');
              const valueRequest = store.get(key);

              valueRequest.onsuccess = () => {
                db.close();
                resolve(valueRequest.result);
              };

              valueRequest.onerror = () => {
                db.close();
                reject(valueRequest.error);
              };
            };

            request.onerror = () => reject(request.error);
          });
        },

        async remove(key: string): Promise<void> {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('worker-cache', 1);

            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction('keyval', 'readwrite');
              const store = tx.objectStore('keyval');
              store.delete(key);

              tx.oncomplete = () => {
                db.close();
                resolve();
              };

              tx.onerror = () => {
                db.close();
                reject(new Error('Failed to remove data'));
              };
            };

            request.onerror = () => reject(request.error);
          });
        }
      });
    }
  }

  /**
   * Execute Web Worker-specific optimizations
   */
  public async optimizeForPlatform(): Promise<void> {
    // Worker-specific optimizations
    // For example, optimize for CPU-intensive tasks

    // Workers shouldn't manipulate DOM and should focus on computation
    // No specific optimizations needed for base case
  }
}

/**
 * Fallback platform adapter for unknown environments
 */
class FallbackPlatformAdapter extends BasePlatformAdapter {
  public readonly platform = EnvironmentType.Unknown;

  /**
   * Detect basic features that should work in most JavaScript environments
   */
  protected async detectFeatures(): Promise<void> {
    this.features.set('webAssembly', typeof WebAssembly !== 'undefined');
    this.features.set('json', typeof JSON !== 'undefined');
    this.features.set('promises', typeof Promise !== 'undefined');
    this.features.set('timeouts', typeof setTimeout !== 'undefined');

    // Conservative feature detection
    this.features.set('webWorkers', false);
    this.features.set('indexedDB', false);
    this.features.set('serviceWorker', false);
    this.features.set('sharedArrayBuffer', false);
    this.features.set('secureContext', false);
    this.features.set('localStorage', false);
  }

  /**
   * Register minimal implementations that should work in most environments
   */
  protected async registerImplementations(): Promise<void> {
    // Fallback in-memory storage implementation
    this.implementations.set('storage', {
      // Simple in-memory storage
      memoryStore: new Map<string, any>(),

      async store(key: string, value: any): Promise<void> {
        this.memoryStore.set(key, value);
      },

      async retrieve(key: string): Promise<any> {
        return this.memoryStore.get(key);
      },

      async remove(key: string): Promise<void> {
        this.memoryStore.delete(key);
      }
    });

    // Fallback synchronous execution implementation
    this.implementations.set('threading', {
      // Fallback with no actual threading
      async spawnWorker(scriptPath: string, data: any): Promise<any> {
        // No worker support, execute synchronously
        console.warn('Worker threads not supported in this environment');

        // Mock implementation that just returns the input
        return data;
      }
    });
  }

  /**
   * No specific optimizations for unknown environments
   */
  public async optimizeForPlatform(): Promise<void> {
    // No specific optimizations for unknown environments
  }
}