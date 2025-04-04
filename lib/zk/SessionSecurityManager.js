/**
 * Session Security Manager for Zero-Knowledge Proof System
 * 
 * Provides comprehensive client-side security, session management, key rotation,
 * and automatic cleanup of sensitive data according to security policies.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module is the security guard for our application's user sessions. Think of it like:
 * 
 * 1. DIGITAL BODYGUARD: Similar to how a security team monitors a high-value client,
 *    this system actively watches over user sessions, detecting suspicious activities,
 *    enforcing time limits, and protecting sensitive operations.
 * 
 * 2. AUTO-LOCKING VAULT: Like a bank vault that automatically locks after periods of
 *    inactivity or when tampering is detected, this system ensures that sensitive
 *    financial information isn't left exposed.
 * 
 * 3. DIGITAL KEY ROTATION: Similar to how high-security facilities regularly change
 *    access codes, this system periodically updates encryption keys to minimize the
 *    risk of unauthorized access even if a key is compromised.
 * 
 * 4. SECURITY CHECKPOINT: Functions like an airport security system that requires
 *    proper identification and monitors for suspicious behavior throughout your journey,
 *    maintaining security from login to logout.
 * 
 * Business value: Protects against session hijacking and unauthorized access to user
 * accounts, prevents data leakage between sessions, provides enhanced security for
 * financial operations, reduces fraud risk, and creates a foundation of trust for
 * users handling sensitive financial information.
 */

import secureKeyManager from './SecureKeyManager.js';
import secureStorage from './secureStorage.js';
import SecurityAuditLogger from './SecurityAuditLogger.js';
import TamperDetection from './TamperDetection.js';

// Default security policy settings
const DEFAULT_SECURITY_SETTINGS = {
  sessionDuration: 30 * 60 * 1000, // 30 minutes
  idleTimeout: 15 * 60 * 1000, // 15 minutes
  keyRotationInterval: 60 * 60 * 1000, // 1 hour
  maxSessionExtensions: 5, // Maximum number of times a session can be extended
  auditLogLevel: 'standard', // standard | verbose | minimal
  enforceTamperDetection: true, // Enable tamper detection
  enableAnomalyDetection: true, // Enable anomaly detection
  forceDestructOnTabClose: true, // Force destruction on tab/window closure
  sensitiveOperationKeyRotation: true, // Rotate keys after sensitive operations
};

/**
 * Session Security Manager class
 * Handles client-side security with session management, key rotation, and security policies
 */
class SessionSecurityManager {
  constructor(customSettings = {}) {
    // Initialize with default settings merged with custom settings
    this.settings = { ...DEFAULT_SECURITY_SETTINGS, ...customSettings };

    // Initialize dependencies
    this.secureKeyManager = secureKeyManager;
    this.secureStorage = secureStorage;
    this.auditLogger = new SecurityAuditLogger({
      logLevel: this.settings.auditLogLevel,
      enableAnomalyDetection: this.settings.enableAnomalyDetection
    });
    this.tamperDetection = new TamperDetection({
      enabled: this.settings.enforceTamperDetection
    });

    // Session state
    this.sessionId = null;
    this.sessionStart = null;
    this.sessionExpiry = null;
    this.lastActivity = null;
    this.sessionPassword = null;
    this.sessionExtensionCount = 0;
    this.sessionKeys = new Map();

    // Intervals
    this.sessionCheckInterval = null;
    this.keyRotationInterval = null;
    this.tamperCheckInterval = null;

    // Setup browser events if in browser environment
    if (typeof window !== 'undefined') {
      this.setupBrowserEvents();
    }

    this.auditLogger.log('SessionSecurityManager initialized', {
      settingsHash: this.hashSettings(this.settings)
    });
  }

  /**
   * Generate a hash of settings for audit logging
   * @private
   */
  hashSettings(settings) {
    // Simple hash for logging, not for security purposes
    try {
      return btoa(JSON.stringify(settings)).substring(0, 20);
    } catch (e) {
      return 'hash-error';
    }
  }

  /**
   * Setup browser event listeners for security
   * @private
   */
  setupBrowserEvents() {
    // Tab/window closure detection
    window.addEventListener('beforeunload', this.handleWindowUnload.bind(this));

    // Visibility change detection
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Activity tracking
    document.addEventListener('mousemove', this.updateLastActivity.bind(this));
    document.addEventListener('keydown', this.updateLastActivity.bind(this));
    document.addEventListener('click', this.updateLastActivity.bind(this));
    document.addEventListener('touchstart', this.updateLastActivity.bind(this));

    // Storage event to detect changes from other tabs
    window.addEventListener('storage', this.detectCrossTabChanges.bind(this));
  }

  /**
   * Initializes a new secure session
   * @param {Object} options - Session options
   * @param {string} options.userId - Optional user identifier for logging
   * @param {boolean} options.persistSessionInfo - Whether to persist minimal session info
   * @returns {Promise<Object>} Session information
   */
  async initializeSession(options = {}) {
    try {
      // Generate a new unique session ID
      this.sessionId = this.generateSessionId();
      this.sessionStart = Date.now();
      this.sessionExpiry = this.sessionStart + this.settings.sessionDuration;
      this.lastActivity = this.sessionStart;
      this.sessionExtensionCount = 0;

      // Generate a secure password for this session
      this.sessionPassword = this.secureKeyManager.generateSecurePassword(32);

      // Create session data for storage
      const sessionData = {
        id: this.sessionId,
        created: this.sessionStart,
        expires: this.sessionExpiry,
        lastActivity: this.lastActivity
      };

      // Add integrity protection
      const protectedSession = await this.tamperDetection.protect(
        sessionData,
        this.sessionPassword
      );

      // Store session information (only metadata, never the password)
      if (options.persistSessionInfo) {
        // Use sessionStorage for security
        window.sessionStorage.setItem(`session-${this.sessionId}`,
          JSON.stringify(protectedSession));
      }

      // Setup intervals for security checks
      this.setupSecurityIntervals();

      // Log the session initialization
      this.auditLogger.log('Session initialized', {
        sessionId: this.sessionId,
        userId: options.userId || 'anonymous',
        expires: new Date(this.sessionExpiry).toISOString()
      });

      return {
        sessionId: this.sessionId,
        expires: this.sessionExpiry,
        created: this.sessionStart
      };
    } catch (error) {
      this.auditLogger.logError('Session initialization failed', {
        error: error.message
      });
      throw new Error(`Failed to initialize secure session: ${error.message}`);
    }
  }

  /**
   * Setup security check intervals
   * @private
   */
  setupSecurityIntervals() {
    // Clear any existing intervals
    this.clearSecurityIntervals();

    // Check session expiry and activity
    this.sessionCheckInterval = setInterval(() => {
      this.checkSessionStatus();
    }, 60 * 1000); // Check every minute

    // Key rotation interval
    this.keyRotationInterval = setInterval(() => {
      this.rotateSessionKeys();
    }, this.settings.keyRotationInterval);

    // Tamper detection check
    if (this.settings.enforceTamperDetection) {
      this.tamperCheckInterval = setInterval(() => {
        this.checkForTampering();
      }, 2 * 60 * 1000); // Check every two minutes
    }
  }

  /**
   * Clear all security intervals
   * @private
   */
  clearSecurityIntervals() {
    if (this.sessionCheckInterval) clearInterval(this.sessionCheckInterval);
    if (this.keyRotationInterval) clearInterval(this.keyRotationInterval);
    if (this.tamperCheckInterval) clearInterval(this.tamperCheckInterval);

    this.sessionCheckInterval = null;
    this.keyRotationInterval = null;
    this.tamperCheckInterval = null;
  }

  /**
   * Generate a secure unique session ID
   * @private
   * @returns {string} Unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const randomPart = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return `${timestamp}-${randomPart}`;
  }

  /**
   * Update last activity timestamp
   * @private
   */
  updateLastActivity() {
    if (!this.sessionId) return; // No active session

    this.lastActivity = Date.now();

    // Check if session is near expiry and extend if needed
    if (this.sessionExpiry - this.lastActivity < 5 * 60 * 1000) { // Within 5 minutes of expiry
      this.extendSession();
    }
  }

  /**
   * Extend the current session if allowed by policy
   * @returns {boolean} Whether the session was extended
   */
  extendSession() {
    if (!this.sessionId) return false; // No active session

    // Check if we've reached the maximum extensions
    if (this.sessionExtensionCount >= this.settings.maxSessionExtensions) {
      this.auditLogger.log('Session extension denied', {
        sessionId: this.sessionId,
        reason: 'max_extensions_reached',
        extensions: this.sessionExtensionCount
      });
      return false;
    }

    // Extend the session
    this.sessionExpiry = Date.now() + this.settings.sessionDuration;
    this.sessionExtensionCount++;

    // Update stored session data
    this.updateSessionData();

    this.auditLogger.log('Session extended', {
      sessionId: this.sessionId,
      newExpiry: new Date(this.sessionExpiry).toISOString(),
      extensionCount: this.sessionExtensionCount
    });

    return true;
  }

  /**
   * Update session data in storage
   * @private
   */
  async updateSessionData() {
    try {
      if (!this.sessionId) return;

      const sessionData = {
        id: this.sessionId,
        created: this.sessionStart,
        expires: this.sessionExpiry,
        lastActivity: this.lastActivity,
        extensionCount: this.sessionExtensionCount
      };

      // Add integrity protection
      const protectedSession = await this.tamperDetection.protect(
        sessionData,
        this.sessionPassword
      );

      // Update in sessionStorage
      window.sessionStorage.setItem(`session-${this.sessionId}`,
        JSON.stringify(protectedSession));
    } catch (error) {
      this.auditLogger.logError('Failed to update session data', {
        sessionId: this.sessionId,
        error: error.message
      });
    }
  }

  /**
   * Check the current session status
   * @private
   */
  checkSessionStatus() {
    if (!this.sessionId) return;

    const now = Date.now();

    // Check if session has expired
    if (now > this.sessionExpiry) {
      this.auditLogger.log('Session expired', { sessionId: this.sessionId });
      this.terminateSession('expired');
      return;
    }

    // Check for inactivity timeout
    if (now - this.lastActivity > this.settings.idleTimeout) {
      this.auditLogger.log('Session terminated due to inactivity', {
        sessionId: this.sessionId,
        lastActivity: new Date(this.lastActivity).toISOString(),
        idleTime: Math.round((now - this.lastActivity) / 1000)
      });
      this.terminateSession('idle');
      return;
    }
  }

  /**
   * Rotate session keys according to policy
   * @private
   */
  async rotateSessionKeys() {
    if (!this.sessionId) return;

    try {
      // Get all keys managed for this session
      const keyIds = Array.from(this.sessionKeys.keys());

      if (keyIds.length === 0) return; // No keys to rotate

      this.auditLogger.log('Starting scheduled key rotation', {
        sessionId: this.sessionId,
        keyCount: keyIds.length
      });

      // Rotate each key
      for (const keyId of keyIds) {
        await this.rotateKey(keyId);
      }

      this.auditLogger.log('Completed scheduled key rotation', {
        sessionId: this.sessionId,
        keyCount: keyIds.length
      });
    } catch (error) {
      this.auditLogger.logError('Key rotation failed', {
        sessionId: this.sessionId,
        error: error.message
      });
    }
  }

  /**
   * Rotate a specific key
   * @param {string} keyId - The ID of the key to rotate
   * @private
   */
  async rotateKey(keyId) {
    try {
      const keyInfo = this.sessionKeys.get(keyId);
      if (!keyInfo) return false;

      // Generate new password
      const newPassword = this.secureKeyManager.generateSecurePassword();

      // Retrieve the data using the old password
      let data;
      switch (keyInfo.type) {
        case 'wallet':
          data = await this.secureStorage.getWallet(keyInfo.dataId, keyInfo.password);
          break;
        case 'input':
          data = await this.secureStorage.getCircuitInput(keyInfo.dataId, keyInfo.password);
          break;
        default:
          throw new Error(`Unknown key type: ${keyInfo.type}`);
      }

      // Store with new password
      let newDataId;
      switch (keyInfo.type) {
        case 'wallet':
          newDataId = await this.secureStorage.storeWallet(data, newPassword);
          break;
        case 'input':
          newDataId = await this.secureStorage.storeCircuitInput(data, newPassword);
          break;
      }

      // Update key registry
      this.sessionKeys.delete(keyId);
      const newKeyId = this.generateKeyId();
      this.sessionKeys.set(newKeyId, {
        ...keyInfo,
        dataId: newDataId,
        password: newPassword,
        rotationTime: Date.now()
      });

      // Remove the old data
      this.secureStorage.removeItem(`${keyInfo.type === 'wallet' ? 'temp-wallet-' : 'zk-input-'}${keyInfo.dataId}`);

      this.auditLogger.log('Key rotated', {
        sessionId: this.sessionId,
        keyType: keyInfo.type,
        keyId: keyId,
        newKeyId: newKeyId
      });

      return {
        newKeyId,
        newDataId
      };
    } catch (error) {
      this.auditLogger.logError('Key rotation failed', {
        sessionId: this.sessionId,
        keyId: keyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate a secure key ID
   * @private
   * @returns {string} Unique key ID
   */
  generateKeyId() {
    const randomBytes = new Uint8Array(12);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Register a key with the session manager
   * @param {string} dataId - Storage ID of the encrypted data
   * @param {string} password - Password used for encryption
   * @param {string} type - Type of key ('wallet' or 'input')
   * @param {Object} metadata - Additional metadata
   * @returns {string} Key ID for future reference
   */
  registerKey(dataId, password, type, metadata = {}) {
    if (!this.sessionId) {
      throw new Error('Cannot register key: No active session');
    }

    const keyId = this.generateKeyId();

    this.sessionKeys.set(keyId, {
      dataId,
      password,
      type,
      metadata,
      createdAt: Date.now(),
      rotationTime: null
    });

    this.auditLogger.log('Key registered', {
      sessionId: this.sessionId,
      keyType: type,
      keyId: keyId
    });

    return keyId;
  }

  /**
   * Get a key from the session manager
   * @param {string} keyId - Key ID to retrieve
   * @returns {Object} Key information
   */
  getKey(keyId) {
    if (!this.sessionId) {
      throw new Error('Cannot get key: No active session');
    }

    const keyInfo = this.sessionKeys.get(keyId);
    if (!keyInfo) {
      throw new Error(`Key not found: ${keyId}`);
    }

    this.auditLogger.log('Key accessed', {
      sessionId: this.sessionId,
      keyType: keyInfo.type,
      keyId: keyId
    });

    // Return copy of key info to prevent modification
    return { ...keyInfo };
  }

  /**
   * Unregister a key from the session manager
   * @param {string} keyId - Key ID to unregister
   * @param {boolean} deleteData - Whether to also delete the associated data
   * @returns {boolean} Whether the key was successfully unregistered
   */
  unregisterKey(keyId, deleteData = true) {
    if (!this.sessionId) {
      throw new Error('Cannot unregister key: No active session');
    }

    const keyInfo = this.sessionKeys.get(keyId);
    if (!keyInfo) {
      return false;
    }

    // Remove from registry
    this.sessionKeys.delete(keyId);

    // Delete associated data if requested
    if (deleteData) {
      this.secureStorage.removeItem(
        `${keyInfo.type === 'wallet' ? 'temp-wallet-' : 'zk-input-'}${keyInfo.dataId}`
      );
    }

    this.auditLogger.log('Key unregistered', {
      sessionId: this.sessionId,
      keyType: keyInfo.type,
      keyId: keyId,
      dataDeleted: deleteData
    });

    return true;
  }

  /**
   * Rotate key after performing a sensitive operation
   * @param {string} keyId - Key ID to rotate
   * @param {string} operation - Operation that triggered rotation
   * @returns {Promise<Object>} New key information
   */
  async rotateSensitiveOperationKey(keyId, operation) {
    if (!this.settings.sensitiveOperationKeyRotation) {
      return { keyId };
    }

    try {
      const result = await this.rotateKey(keyId);

      this.auditLogger.log('Key rotated after sensitive operation', {
        sessionId: this.sessionId,
        keyId: keyId,
        newKeyId: result.newKeyId,
        operation: operation
      });

      return result;
    } catch (error) {
      this.auditLogger.logError('Failed to rotate key after sensitive operation', {
        sessionId: this.sessionId,
        keyId: keyId,
        operation: operation,
        error: error.message
      });

      // Continue without rotation in case of error
      return { keyId };
    }
  }

  /**
   * Check for tampering of session and key data
   * @private
   */
  async checkForTampering() {
    if (!this.sessionId || !this.settings.enforceTamperDetection) return;

    try {
      // Check session data
      const sessionData = window.sessionStorage.getItem(`session-${this.sessionId}`);
      if (sessionData) {
        const parsedData = JSON.parse(sessionData);
        const isValid = await this.tamperDetection.verify(
          parsedData,
          this.sessionPassword
        );

        if (!isValid) {
          this.auditLogger.logSecurity('Session data tampering detected', {
            sessionId: this.sessionId,
            action: 'tampering_detected',
            severity: 'high'
          });

          this.terminateSession('tampered');
          return;
        }
      }

      // Check key-specific data (could be enhanced with more checks)
    } catch (error) {
      this.auditLogger.logError('Tampering check failed', {
        sessionId: this.sessionId,
        error: error.message
      });
    }
  }

  /**
   * Handle window/tab closure
   * @private
   */
  handleWindowUnload(event) {
    if (this.settings.forceDestructOnTabClose && this.sessionId) {
      // Log the event before termination
      this.auditLogger.log('Window unload detected', {
        sessionId: this.sessionId
      });

      // Clean up session data and keys
      this.terminateSession('tab_closed');
    }
  }

  /**
   * Handle visibility change (tab switching)
   * @private
   */
  handleVisibilityChange() {
    if (!this.sessionId) return;

    if (document.visibilityState === 'visible') {
      // Tab is now visible - check for tampering
      this.checkForTampering();
      this.updateLastActivity();
    } else {
      // Tab is now hidden - consider additional protections
      this.auditLogger.log('Tab visibility changed to hidden', {
        sessionId: this.sessionId
      });
    }
  }

  /**
   * Detect changes from other tabs or windows
   * @private
   */
  detectCrossTabChanges(event) {
    if (!this.sessionId) return;

    // Check for suspicious cross-tab interactions with session data
    if (event.key.startsWith('session-') ||
      event.key.startsWith('temp-wallet-') ||
      event.key.startsWith('zk-input-')) {

      this.auditLogger.log('Cross-tab storage change detected', {
        sessionId: this.sessionId,
        key: event.key
      });

      // Optionally enforce additional security checks
    }
  }

  /**
   * Terminate the current session
   * @param {string} reason - Reason for termination
   */
  terminateSession(reason = 'user_requested') {
    if (!this.sessionId) return;

    const oldSessionId = this.sessionId;

    try {
      // Log termination
      this.auditLogger.log('Session terminating', {
        sessionId: oldSessionId,
        reason: reason
      });

      // Destroy all keys
      const keyIds = Array.from(this.sessionKeys.keys());
      for (const keyId of keyIds) {
        this.unregisterKey(keyId, true);
      }

      // Remove session data
      window.sessionStorage.removeItem(`session-${oldSessionId}`);

      // Clear intervals
      this.clearSecurityIntervals();

      // Clean up session state
      this.sessionId = null;
      this.sessionStart = null;
      this.sessionExpiry = null;
      this.lastActivity = null;
      this.sessionPassword = null;
      this.sessionExtensionCount = 0;

      // Secure wipe the in-memory session password
      this.secureKeyManager.secureWipe(this.sessionPassword);

      // Final cleanup log
      this.auditLogger.log('Session terminated', {
        sessionId: oldSessionId,
        reason: reason
      });

      return true;
    } catch (error) {
      this.auditLogger.logError('Session termination error', {
        sessionId: oldSessionId,
        reason: reason,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Store data securely in the session
   * @param {any} data - Data to store
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Storage information with key ID
   */
  async storeData(data, options = {}) {
    if (!this.sessionId) {
      throw new Error('Cannot store data: No active session');
    }

    try {
      const type = options.type || 'input';
      const password = options.password || this.secureKeyManager.generateSecurePassword();

      // Store the data
      let dataId;
      if (type === 'wallet') {
        dataId = await this.secureStorage.storeWallet(data, password);
      } else {
        dataId = await this.secureStorage.storeCircuitInput(data, password);
      }

      // Register the key
      const keyId = this.registerKey(dataId, password, type, options.metadata);

      this.auditLogger.log('Data stored securely', {
        sessionId: this.sessionId,
        keyId: keyId,
        dataType: type
      });

      return {
        keyId,
        dataId
      };
    } catch (error) {
      this.auditLogger.logError('Data storage failed', {
        sessionId: this.sessionId,
        error: error.message
      });
      throw new Error(`Failed to store data securely: ${error.message}`);
    }
  }

  /**
   * Retrieve data securely from the session
   * @param {string} keyId - Key ID to retrieve
   * @param {Object} options - Retrieval options
   * @returns {Promise<any>} The retrieved data
   */
  async retrieveData(keyId, options = {}) {
    if (!this.sessionId) {
      throw new Error('Cannot retrieve data: No active session');
    }

    try {
      const keyInfo = this.getKey(keyId);

      // Retrieve the data
      let data;
      if (keyInfo.type === 'wallet') {
        data = await this.secureStorage.getWallet(keyInfo.dataId, keyInfo.password);
      } else {
        data = await this.secureStorage.getCircuitInput(keyInfo.dataId, keyInfo.password);
      }

      this.auditLogger.log('Data retrieved securely', {
        sessionId: this.sessionId,
        keyId: keyId,
        dataType: keyInfo.type
      });

      // Rotate key after sensitive operation if needed
      if (options.isSensitiveOperation && this.settings.sensitiveOperationKeyRotation) {
        const newKey = await this.rotateSensitiveOperationKey(keyId, 'data_access');

        // Return data with new key information
        return {
          data,
          newKeyId: newKey.newKeyId
        };
      }

      return { data };
    } catch (error) {
      this.auditLogger.logError('Data retrieval failed', {
        sessionId: this.sessionId,
        keyId: keyId,
        error: error.message
      });
      throw new Error(`Failed to retrieve data securely: ${error.message}`);
    }
  }

  /**
   * Check if a session is active
   * @returns {boolean} Whether a session is active
   */
  isSessionActive() {
    return !!this.sessionId && Date.now() < this.sessionExpiry;
  }

  /**
   * Get current session information
   * @returns {Object} Session information
   */
  getSessionInfo() {
    if (!this.sessionId) {
      return { active: false };
    }

    return {
      active: true,
      sessionId: this.sessionId,
      created: this.sessionStart,
      expires: this.sessionExpiry,
      lastActivity: this.lastActivity,
      extensionCount: this.sessionExtensionCount,
      remainingTime: Math.max(0, this.sessionExpiry - Date.now()),
      idleTime: Date.now() - this.lastActivity,
      managedKeys: this.sessionKeys.size
    };
  }
}

// Export as singleton
const sessionSecurityManager = new SessionSecurityManager();
export default sessionSecurityManager;