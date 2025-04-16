/**
 * @fileoverview Environment and feature detection for multi-platform deployments
 */

import { EnvironmentType } from './DeploymentConfig';

/**
 * Results of feature detection
 */
export interface FeatureDetectionResult {
  /** Environment type */
  environment: EnvironmentType;
  /** Whether Web Workers are supported */
  supportsWebWorkers: boolean;
  /** Whether WebAssembly is supported */
  supportsWebAssembly: boolean;
  /** Whether IndexedDB is supported */
  supportsIndexedDB: boolean;
  /** Whether Service Worker is supported */
  supportsServiceWorker: boolean;
  /** Whether SharedArrayBuffer is supported */
  supportsSharedArrayBuffer: boolean;
  /** Whether running in a secure context */
  isSecureContext: boolean;
  /** Whether localStorage is supported */
  supportsLocalStorage: boolean;
  /** Detected CPU cores */
  cpuCores: number;
  /** Whether the device has high-end capabilities */
  isHighEndDevice: boolean;
  /** Whether network is available */
  hasNetwork: boolean;
  /** Whether persistent storage is available */
  supportsPersistentStorage: boolean;
}

/**
 * Detects environment type and available features
 */
export class EnvironmentDetector {
  /**
   * Detect the current environment type
   */
  public detectEnvironment(): EnvironmentType {
    // Check for Node.js
    if (typeof process !== 'undefined' && 
        process.versions && 
        process.versions.node) {
      return EnvironmentType.Node;
    }
    
    // Check for Web Worker
    if (typeof self !== 'undefined' && 
        typeof window === 'undefined' && 
        // Check if this is a worker context without direct reference to importScripts
        self.constructor && self.constructor.name === 'DedicatedWorkerGlobalScope') {
      return EnvironmentType.Worker;
    }
    
    // Check for mobile
    const isMobile = this.isMobileDevice();
    if (isMobile) {
      return EnvironmentType.Mobile;
    }
    
    // Check for browser
    if (typeof window !== 'undefined') {
      return EnvironmentType.Browser;
    }
    
    // Default to unknown
    return EnvironmentType.Unknown;
  }
  
  /**
   * Detect available features in the current environment
   */
  public detectFeatures(): FeatureDetectionResult {
    const environment = this.detectEnvironment();
    
    // Default values for Node.js
    if (environment === EnvironmentType.Node) {
      return {
        environment,
        supportsWebWorkers: false,
        supportsWebAssembly: true,
        supportsIndexedDB: false,
        supportsServiceWorker: false,
        supportsSharedArrayBuffer: true,
        isSecureContext: true,
        supportsLocalStorage: false,
        cpuCores: this.detectCPUCores(),
        isHighEndDevice: true,
        hasNetwork: this.detectNetwork(),
        supportsPersistentStorage: true
      };
    }
    
    // Browser, Mobile, or Worker environment detection
    return {
      environment,
      supportsWebWorkers: this.detectWebWorkers(),
      supportsWebAssembly: this.detectWebAssembly(),
      supportsIndexedDB: this.detectIndexedDB(),
      supportsServiceWorker: this.detectServiceWorker(),
      supportsSharedArrayBuffer: this.detectSharedArrayBuffer(),
      isSecureContext: this.detectSecureContext(),
      supportsLocalStorage: this.detectLocalStorage(),
      cpuCores: this.detectCPUCores(),
      isHighEndDevice: this.isHighEndDevice(),
      hasNetwork: this.detectNetwork(),
      supportsPersistentStorage: this.detectPersistentStorage()
    };
  }
  
  /**
   * Check if running on a mobile device
   */
  private isMobileDevice(): boolean {
    if (typeof navigator === 'undefined' || !navigator.userAgent) {
      return false;
    }
    
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // Check for mobile-specific keywords in user agent
    if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(userAgent) || 
        /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(userAgent.substr(0, 4))) {
      return true;
    }
    
    // Check for React Native
    if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
      return true;
    }
    
    // Check for mobile-specific screen characteristics
    if (typeof window !== 'undefined' && window.screen) {
      // These dimensions are typically found on mobile devices
      const screenWidth = window.screen.width || 0;
      const screenHeight = window.screen.height || 0;
      const maxDimension = Math.max(screenWidth, screenHeight);
      const minDimension = Math.min(screenWidth, screenHeight);
      
      // Typical mobile dimension patterns
      if (maxDimension <= 1024 && minDimension <= 768) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Detect if Web Workers are supported
   */
  private detectWebWorkers(): boolean {
    return typeof Worker !== 'undefined';
  }
  
  /**
   * Detect if WebAssembly is supported
   */
  private detectWebAssembly(): boolean {
    return typeof WebAssembly !== 'undefined';
  }
  
  /**
   * Detect if IndexedDB is supported
   */
  private detectIndexedDB(): boolean {
    return typeof indexedDB !== 'undefined';
  }
  
  /**
   * Detect if Service Worker is supported
   */
  private detectServiceWorker(): boolean {
    return typeof navigator !== 'undefined' && 
           'serviceWorker' in navigator;
  }
  
  /**
   * Detect if SharedArrayBuffer is supported
   */
  private detectSharedArrayBuffer(): boolean {
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox') && 
        typeof document !== 'undefined' && document.domain === 'localhost') {
      // Firefox on localhost may support SAB without proper headers
      return typeof SharedArrayBuffer !== 'undefined';
    }
    
    // For all other environments, we need proper headers and SAB support
    try {
      // Testing both existence and usability
      if (typeof SharedArrayBuffer !== 'undefined') {
        new SharedArrayBuffer(1); // Will throw if SAB is not actually available
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect if running in a secure context
   */
  private detectSecureContext(): boolean {
    return typeof window !== 'undefined' && 
           window.isSecureContext === true;
  }
  
  /**
   * Detect if localStorage is supported
   */
  private detectLocalStorage(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    
    try {
      const testKey = '__ls_test__';
      localStorage.setItem(testKey, testKey);
      const result = localStorage.getItem(testKey) === testKey;
      localStorage.removeItem(testKey);
      return result;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Detect number of CPU cores
   */
  private detectCPUCores(): number {
    // For Node.js
    if (typeof process !== 'undefined' && 
        process.versions && 
        process.versions.node) {
      try {
        const os = require('os');
        return os.cpus().length;
      } catch (e) {
        return 1;
      }
    }
    
    // For browsers
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }
    
    // Default if detection fails
    return 2;
  }
  
  /**
   * Determine if the device is high-end based on various factors
   */
  private isHighEndDevice(): boolean {
    const cores = this.detectCPUCores();
    const memory = this.detectAvailableMemory();
    
    // High-end device has 4+ cores and 4GB+ RAM
    return cores >= 4 && memory >= 4096;
  }
  
  /**
   * Detect approximate available memory in MB
   */
  private detectAvailableMemory(): number {
    // For browsers that support memory info API (Chrome)
    if (typeof performance !== 'undefined' && 
        (performance as any).memory && 
        (performance as any).memory.jsHeapSizeLimit) {
      return Math.floor((performance as any).memory.jsHeapSizeLimit / (1024 * 1024));
    }
    
    // For Node.js
    if (typeof process !== 'undefined' && 
        process.versions && 
        process.versions.node) {
      try {
        const os = require('os');
        return Math.floor(os.totalmem() / (1024 * 1024));
      } catch (e) {
        return 1024; // Default 1GB for Node.js
      }
    }
    
    // Estimate based on user agent for browsers
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      const ua = navigator.userAgent.toLowerCase();
      
      // Higher-end device heuristics
      if (this.detectCPUCores() >= 8 || 
          ua.includes('macintosh') || 
          ua.includes('win64')) {
        return 4096; // Assume 4GB
      }
      
      // Mid-range device
      if (this.detectCPUCores() >= 4) {
        return 2048; // Assume 2GB
      }
      
      // Lower-end device
      return 1024; // Assume 1GB
    }
    
    // Conservative default
    return 1024;
  }
  
  /**
   * Detect if network is available
   */
  private detectNetwork(): boolean {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    
    // Default to true if we can't detect
    return true;
  }
  
  /**
   * Detect if persistent storage is available
   */
  private detectPersistentStorage(): boolean {
    if (typeof navigator !== 'undefined' && 
        'storage' in navigator && 
        'persisted' in navigator.storage) {
      return true; // API exists, actual persistence check would be async
    }
    
    // For Node.js assume true
    if (this.detectEnvironment() === EnvironmentType.Node) {
      return true;
    }
    
    return false;
  }
}