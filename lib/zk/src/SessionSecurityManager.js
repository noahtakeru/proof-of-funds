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
import { zkErrorLogger } from './zkErrorLogger.js';
import { 
  ZKError, 
  SecurityError, 
  InputError, 
  SystemError,
  CompatibilityError,
  ErrorCode 
} from './zkErrorHandler.js';

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
    const operationId = `init_session_${Date.now()}`;
    
    try {
      // Generate a new unique session ID
      this.sessionId = this.generateSessionId();
      this.sessionStart = Date.now();
      this.sessionExpiry = this.sessionStart + this.settings.sessionDuration;
      this.lastActivity = this.sessionStart;
      this.sessionExtensionCount = 0;

      // Log the initialization start to both logging systems
      this.auditLogger.log('Session initialization started', {
        sessionId: this.sessionId,
        userId: options.userId || 'anonymous'
      });
      
      zkErrorLogger.log('INFO', 'Session initialization started', {
        operationId,
        sessionId: this.sessionId
      });

      // Generate a secure password for this session
      try {
        this.sessionPassword = this.secureKeyManager.generateSecurePassword(32);
      } catch (keyError) {
        throw new SecurityError('Failed to generate secure session password', {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId,
          securityCritical: true,
          recoverable: false,
          details: { source: 'SecureKeyManager' }
        });
      }

      // Create session data for storage
      const sessionData = {
        id: this.sessionId,
        created: this.sessionStart,
        expires: this.sessionExpiry,
        lastActivity: this.lastActivity
      };

      // Add integrity protection
      let protectedSession;
      try {
        protectedSession = await this.tamperDetection.protect(
          sessionData,
          this.sessionPassword
        );
      } catch (protectionError) {
        throw new SecurityError('Failed to add tamper protection to session data', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          securityCritical: true,
          recoverable: false,
          details: { originalError: protectionError.message }
        });
      }

      // Store session information (only metadata, never the password)
      if (options.persistSessionInfo) {
        try {
          // Use sessionStorage for security
          if (typeof window === 'undefined' || !window.sessionStorage) {
            throw new CompatibilityError('Session storage not available in this environment', {
              code: ErrorCode.COMPATIBILITY_API_UNAVAILABLE,
              operationId,
              userFixable: false,
              recoverable: false
            });
          }
          
          window.sessionStorage.setItem(`session-${this.sessionId}`,
            JSON.stringify(protectedSession));
        } catch (storageError) {
          // Non-critical error - we can continue even if storage fails
          zkErrorLogger.logError(new SystemError('Failed to persist session information', {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            recoverable: true,
            details: { 
              originalError: storageError.message,
              storageType: 'sessionStorage' 
            }
          }));
        }
      }

      // Setup intervals for security checks
      this.setupSecurityIntervals();

      // Log the successful session initialization
      this.auditLogger.log('Session initialized', {
        sessionId: this.sessionId,
        userId: options.userId || 'anonymous',
        expires: new Date(this.sessionExpiry).toISOString()
      });
      
      zkErrorLogger.log('INFO', 'Session initialized successfully', {
        operationId,
        sessionId: this.sessionId,
        expires: new Date(this.sessionExpiry).toISOString()
      });

      return {
        sessionId: this.sessionId,
        expires: this.sessionExpiry,
        created: this.sessionStart
      };
    } catch (error) {
      // Log to both logging systems
      this.auditLogger.logError('Session initialization failed', {
        error: error.message
      });
      
      // If it's already a ZKError, just log it; otherwise wrap it
      const zkError = error instanceof ZKError 
        ? error 
        : new SystemError(`Failed to initialize secure session: ${error.message}`, {
            code: ErrorCode.SYSTEM_NOT_INITIALIZED,
            operationId,
            recoverable: false,
            details: { originalError: error.message }
          });
          
      zkErrorLogger.logError(zkError);
      
      // Rethrow the ZKError
      throw zkError;
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
    const operationId = `register_key_${Date.now()}`;
    
    if (!this.sessionId) {
      const error = new SystemError('Cannot register key: No active session', {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        userFixable: true,
        recoverable: true,
        recommendedAction: 'Initialize a session before registering keys'
      });
      
      zkErrorLogger.logError(error);
      throw error;
    }
    
    // Input validation
    if (!dataId) {
      throw new InputError('Data ID is required to register a key', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        userFixable: false, // Not user fixable as this is an internal error
        details: { dataIdProvided: !!dataId }
      });
    }
    
    if (!password) {
      throw new SecurityError('Password is required to register a key', {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        securityCritical: true,
        details: { passwordProvided: !!password }
      });
    }
    
    if (!type || (type !== 'wallet' && type !== 'input')) {
      throw new InputError('Invalid key type specified', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        userFixable: false, // Not user fixable as this is an internal error
        details: { 
          providedType: type,
          allowedTypes: ['wallet', 'input'] 
        }
      });
    }
    
    try {
      const keyId = this.generateKeyId();
  
      this.sessionKeys.set(keyId, {
        dataId,
        password,
        type,
        metadata: metadata || {},
        createdAt: Date.now(),
        rotationTime: null
      });
  
      // Log to both systems
      this.auditLogger.log('Key registered', {
        sessionId: this.sessionId,
        keyType: type,
        keyId: keyId
      });
      
      zkErrorLogger.log('INFO', 'Key registered successfully', {
        operationId,
        sessionId: this.sessionId,
        keyType: type,
        keyId: keyId
      });
  
      return keyId;
    } catch (error) {
      // If it's already a ZKError, just log it; otherwise wrap it
      if (error instanceof ZKError) {
        zkErrorLogger.logError(error);
      } else {
        zkErrorLogger.logError(new SystemError(`Failed to register key: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          details: { 
            dataId,
            type,
            originalError: error.message 
          }
        }));
      }
      
      throw error;
    }
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
    const operationId = `unregister_key_${Date.now()}`;
    
    if (!this.sessionId) {
      const error = new SystemError('Cannot unregister key: No active session', {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        userFixable: true,
        recoverable: true,
        recommendedAction: 'Initialize a session before unregistering keys'
      });
      
      zkErrorLogger.logError(error);
      throw error;
    }
    
    // Input validation
    if (!keyId) {
      const error = new InputError('Key ID is required to unregister a key', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        userFixable: true,
        details: { keyIdProvided: !!keyId }
      });
      
      zkErrorLogger.logError(error);
      throw error;
    }

    try {
      const keyInfo = this.sessionKeys.get(keyId);
      if (!keyInfo) {
        zkErrorLogger.log('INFO', 'Key not found for unregistration', {
          operationId,
          sessionId: this.sessionId,
          keyId: keyId
        });
        return false;
      }
  
      // Remove from registry
      this.sessionKeys.delete(keyId);
  
      // Delete associated data if requested
      if (deleteData) {
        try {
          const storageKey = `${keyInfo.type === 'wallet' ? 'temp-wallet-' : 'zk-input-'}${keyInfo.dataId}`;
          this.secureStorage.removeItem(storageKey);
        } catch (deleteError) {
          // Log deletion error but continue with unregistration
          zkErrorLogger.logError(new SystemError('Failed to delete associated data during key unregistration', {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            recoverable: true,
            details: { 
              keyId,
              dataId: keyInfo.dataId,
              keyType: keyInfo.type,
              originalError: deleteError.message 
            }
          }));
          
          // Still consider unregistration successful even if data deletion failed
        }
      }
  
      // Log to both systems
      this.auditLogger.log('Key unregistered', {
        sessionId: this.sessionId,
        keyType: keyInfo.type,
        keyId: keyId,
        dataDeleted: deleteData
      });
      
      zkErrorLogger.log('INFO', 'Key unregistered successfully', {
        operationId,
        sessionId: this.sessionId,
        keyType: keyInfo.type,
        keyId: keyId,
        dataDeleted: deleteData
      });
  
      return true;
    } catch (error) {
      // If it's already a ZKError, just log it; otherwise wrap it
      if (error instanceof ZKError) {
        zkErrorLogger.logError(error);
      } else {
        zkErrorLogger.logError(new SystemError(`Failed to unregister key: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          details: { 
            keyId,
            originalError: error.message 
          }
        }));
      }
      
      // Propagate errors for security-critical operations
      throw error;
    }
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
    
    const operationId = `tampering_check_${Date.now()}`;

    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined' || !window.sessionStorage) {
        zkErrorLogger.logError(new CompatibilityError('Session storage not available for tamper check', {
          code: ErrorCode.COMPATIBILITY_API_UNAVAILABLE,
          operationId,
          recoverable: true
        }));
        return;
      }
      
      // Check session data
      const sessionData = window.sessionStorage.getItem(`session-${this.sessionId}`);
      if (sessionData) {
        let parsedData;
        try {
          parsedData = JSON.parse(sessionData);
        } catch (jsonError) {
          throw new SecurityError('Session data corrupted - invalid JSON format', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            securityCritical: true,
            details: { 
              dataLength: sessionData?.length,
              jsonError: jsonError.message 
            }
          });
        }
        
        let isValid;
        try {
          isValid = await this.tamperDetection.verify(
            parsedData,
            this.sessionPassword
          );
        } catch (verifyError) {
          throw new SecurityError('Failed to verify session data integrity', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            securityCritical: true,
            details: { originalError: verifyError.message }
          });
        }

        if (!isValid) {
          // Log to both logging systems
          this.auditLogger.logSecurity('Session data tampering detected', {
            sessionId: this.sessionId,
            action: 'tampering_detected',
            severity: 'high'
          });
          
          zkErrorLogger.logError(new SecurityError('Session data tampering detected', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            securityCritical: true,
            details: { sessionId: this.sessionId }
          }));

          this.terminateSession('tampered');
          return;
        }
      }

      // Check key-specific data (could be enhanced with more checks)
      for (const [keyId, keyInfo] of this.sessionKeys.entries()) {
        if (keyInfo.type === 'wallet' || keyInfo.type === 'input') {
          const storageKey = `${keyInfo.type === 'wallet' ? 'temp-wallet-' : 'zk-input-'}${keyInfo.dataId}`;
          const keyData = this.secureStorage.getItem(storageKey);
          
          if (keyData && keyData.metadata && keyData.metadata.timestamp) {
            // Check if the timestamp has been tampered with (basic check)
            const storedTime = new Date(keyData.metadata.timestamp).getTime();
            if (storedTime > Date.now()) {
              zkErrorLogger.logError(new SecurityError('Key data tampering detected - invalid timestamp', {
                code: ErrorCode.SECURITY_DATA_INTEGRITY,
                operationId,
                securityCritical: true,
                details: { 
                  keyType: keyInfo.type,
                  keyId
                }
              }));
              
              // Rotate this key immediately
              await this.rotateKey(keyId);
            }
          }
        }
      }
      
      // Log successful check
      zkErrorLogger.log('INFO', 'Tamper check completed successfully', {
        operationId,
        sessionId: this.sessionId
      });
    } catch (error) {
      // Log to both logging systems
      this.auditLogger.logError('Tampering check failed', {
        sessionId: this.sessionId,
        error: error.message
      });
      
      // If it's already a ZKError, just log it; otherwise wrap it
      if (error instanceof ZKError) {
        zkErrorLogger.logError(error);
      } else {
        zkErrorLogger.logError(new SecurityError('Tampering check failed', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          securityCritical: true,
          details: { originalError: error.message }
        }));
      }
      
      // Terminate session on any error during tampering check as a precaution
      this.terminateSession('tamper_check_error');
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
    const operationId = `store_data_${Date.now()}`;
    
    if (!this.sessionId) {
      const error = new SystemError('Cannot store data: No active session', {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        userFixable: true,
        recoverable: true,
        recommendedAction: 'Initialize a session before storing data'
      });
      
      zkErrorLogger.logError(error);
      throw error;
    }

    // Validate input data
    if (!data) {
      const error = new InputError('Cannot store empty or null data', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        userFixable: true,
        details: { dataProvided: !!data }
      });
      
      zkErrorLogger.logError(error);
      throw error;
    }

    try {
      const type = options.type || 'input';
      
      // Validate data type
      if (type !== 'wallet' && type !== 'input') {
        throw new InputError('Invalid data type specified', {
          code: ErrorCode.INPUT_TYPE_ERROR,
          operationId,
          userFixable: true,
          details: { 
            providedType: type,
            allowedTypes: ['wallet', 'input'] 
          },
          recommendedAction: 'Specify either "wallet" or "input" as the data type'
        });
      }

      // Generate or use provided password
      let password;
      try {
        password = options.password || this.secureKeyManager.generateSecurePassword();
      } catch (keyError) {
        throw new SecurityError('Failed to generate secure password for data', {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId,
          securityCritical: true,
          details: { source: 'SecureKeyManager' }
        });
      }

      // Store the data
      let dataId;
      try {
        if (type === 'wallet') {
          dataId = await this.secureStorage.storeWallet(data, password);
        } else {
          dataId = await this.secureStorage.storeCircuitInput(data, password);
        }
      } catch (storageError) {
        throw new SystemError(`Failed to store ${type} data securely`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          details: { 
            storageType: type,
            originalError: storageError.message 
          }
        });
      }

      // Register the key
      let keyId;
      try {
        keyId = this.registerKey(dataId, password, type, options.metadata);
      } catch (registrationError) {
        // Clean up previously stored data if key registration fails
        try {
          const storageKey = `${type === 'wallet' ? 'temp-wallet-' : 'zk-input-'}${dataId}`;
          this.secureStorage.removeItem(storageKey);
        } catch (cleanupError) {
          // Log but don't throw this error
          zkErrorLogger.logError(new SystemError('Failed to clean up after key registration error', {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            details: { 
              originalError: cleanupError.message,
              dataId,
              type 
            }
          }));
        }
        
        // Rethrow the original error
        throw registrationError;
      }

      // Log success to both logging systems
      this.auditLogger.log('Data stored securely', {
        sessionId: this.sessionId,
        keyId: keyId,
        dataType: type
      });
      
      zkErrorLogger.log('INFO', 'Data stored securely', {
        operationId,
        sessionId: this.sessionId,
        keyId: keyId,
        dataType: type
      });

      return {
        keyId,
        dataId
      };
    } catch (error) {
      // Log to both logging systems
      this.auditLogger.logError('Data storage failed', {
        sessionId: this.sessionId,
        error: error.message
      });
      
      // If it's already a ZKError, just log it; otherwise wrap it
      if (error instanceof ZKError) {
        zkErrorLogger.logError(error);
      } else {
        zkErrorLogger.logError(new SystemError(`Failed to store data securely: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          details: { originalError: error.message }
        }));
      }
      
      throw error;
    }
  }

  /**
   * Retrieve data securely from the session
   * @param {string} keyId - Key ID to retrieve
   * @param {Object} options - Retrieval options
   * @returns {Promise<any>} The retrieved data
   */
  async retrieveData(keyId, options = {}) {
    const operationId = `retrieve_data_${Date.now()}`;
    
    if (!this.sessionId) {
      const error = new SystemError('Cannot retrieve data: No active session', {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        userFixable: true,
        recoverable: true,
        recommendedAction: 'Initialize a session before retrieving data'
      });
      
      zkErrorLogger.logError(error);
      throw error;
    }
    
    // Input validation
    if (!keyId) {
      const error = new InputError('Key ID is required to retrieve data', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        userFixable: true,
        recoverable: true,
        recommendedAction: 'Provide a valid key ID'
      });
      
      zkErrorLogger.logError(error);
      throw error;
    }

    try {
      // Get key information
      let keyInfo;
      try {
        keyInfo = this.getKey(keyId);
      } catch (keyError) {
        throw new SecurityError(`Invalid or unknown key ID: ${keyId}`, {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId,
          userFixable: false,
          recoverable: false,
          details: { keyId }
        });
      }

      // Log retrieval attempt
      zkErrorLogger.log('INFO', 'Attempting to retrieve secure data', {
        operationId,
        sessionId: this.sessionId,
        keyId: keyId,
        dataType: keyInfo.type
      });

      // Retrieve the data
      let data;
      try {
        if (keyInfo.type === 'wallet') {
          data = await this.secureStorage.getWallet(keyInfo.dataId, keyInfo.password);
        } else {
          data = await this.secureStorage.getCircuitInput(keyInfo.dataId, keyInfo.password);
        }
      } catch (retrievalError) {
        throw new SecurityError(`Failed to retrieve ${keyInfo.type} data`, {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          securityCritical: true,
          details: { 
            keyId,
            dataId: keyInfo.dataId,
            dataType: keyInfo.type,
            originalError: retrievalError.message 
          }
        });
      }
      
      // Ensure data integrity
      if (!data) {
        throw new SecurityError('Retrieved data is empty or corrupted', {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: false,
          securityCritical: true,
          details: { 
            keyId,
            dataId: keyInfo.dataId,
            dataType: keyInfo.type
          }
        });
      }

      // Log successful retrieval to both logging systems
      this.auditLogger.log('Data retrieved securely', {
        sessionId: this.sessionId,
        keyId: keyId,
        dataType: keyInfo.type
      });
      
      zkErrorLogger.log('INFO', 'Data retrieved successfully', {
        operationId,
        sessionId: this.sessionId,
        keyId: keyId,
        dataType: keyInfo.type
      });

      // Rotate key after sensitive operation if needed
      if (options.isSensitiveOperation && this.settings.sensitiveOperationKeyRotation) {
        try {
          const newKey = await this.rotateSensitiveOperationKey(keyId, 'data_access');

          // Return data with new key information
          return {
            data,
            newKeyId: newKey.newKeyId
          };
        } catch (rotationError) {
          // Log rotation error but continue - this is not critical
          zkErrorLogger.logError(new SecurityError('Key rotation after retrieval failed', {
            code: ErrorCode.SECURITY_KEY_ERROR,
            operationId,
            recoverable: true,
            securityCritical: false,
            details: { 
              keyId,
              dataType: keyInfo.type,
              originalError: rotationError.message 
            }
          }));
          
          // Continue with original key
          return { data };
        }
      }

      return { data };
    } catch (error) {
      // Log to both logging systems
      this.auditLogger.logError('Data retrieval failed', {
        sessionId: this.sessionId,
        keyId: keyId,
        error: error.message
      });
      
      // If it's already a ZKError, just log it; otherwise wrap it
      if (error instanceof ZKError) {
        zkErrorLogger.logError(error);
      } else {
        zkErrorLogger.logError(new SystemError(`Failed to retrieve data securely: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          details: { 
            keyId,
            originalError: error.message 
          }
        }));
      }
      
      throw error;
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