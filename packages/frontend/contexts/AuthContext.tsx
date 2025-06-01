/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Supports both wallet-based and email-based authentication.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Define user type
export interface User {
  id: string;
  email?: string;
  walletAddress?: string;
  permissions: string[];
}

// Define auth state
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  authType: 'wallet' | 'email' | null;
}

// Define auth context interface
export interface AuthContextType extends AuthState {
  loginWithWallet: (signature: string, message: string, walletAddress: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  verifyEmailToken: (token: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
  authType: null,
  loginWithWallet: async () => false,
  loginWithEmail: async () => false,
  register: async () => false,
  logout: async () => {},
  refreshToken: async () => false,
  verifyEmailToken: async () => false,
  resendVerificationEmail: async () => false,
  requestPasswordReset: async () => false,
  resetPassword: async () => false,
  changePassword: async () => false,
});

// Token refresh interval (5 minutes)
const REFRESH_INTERVAL = 5 * 60 * 1000;

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Authentication state
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
    authType: null,
  });

  // Ref for refresh interval
  const refreshIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Token storage keys
  const ACCESS_TOKEN_KEY = 'pof_access_token';
  const REFRESH_TOKEN_KEY = 'pof_refresh_token';
  
  /**
   * Initialize auth state from local storage
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        
        if (!accessToken) {
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
        // Check if token is valid by calling /api/auth/me endpoint
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (response.ok) {
          const userData = await response.json();
          
          setState({
            isAuthenticated: true,
            user: userData.user,
            isLoading: false,
            error: null,
            authType: userData.user.walletAddress ? 'wallet' : 'email',
          });
          
          // Set up token refresh interval
          setupRefreshInterval();
        } else {
          // Try to refresh token if access token is invalid
          const success = await refreshToken();
          
          if (!success) {
            // Clear tokens if refresh fails
            clearTokens();
            setState({
              isAuthenticated: false,
              user: null,
              isLoading: false,
              error: null,
              authType: null,
            });
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearTokens();
        setState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: 'Authentication failed',
          authType: null,
        });
      }
    };
    
    initializeAuth();
    
    return () => {
      // Clean up refresh interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);
  
  /**
   * Set up token refresh interval
   */
  const setupRefreshInterval = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    refreshIntervalRef.current = setInterval(async () => {
      await refreshToken();
    }, REFRESH_INTERVAL);
  };
  
  /**
   * Store tokens in local storage
   */
  const storeTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  };
  
  /**
   * Clear tokens from local storage
   */
  const clearTokens = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  };
  
  /**
   * Refresh access token
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      
      if (!refreshToken) {
        return false;
      }
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (!response.ok) {
        throw new Error('Token refresh failed');
      }
      
      const data = await response.json();
      
      if (data.success && data.accessToken && data.refreshToken) {
        storeTokens(data.accessToken, data.refreshToken);
        
        // Get user data with new token
        const userResponse = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${data.accessToken}`,
          },
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          
          setState({
            isAuthenticated: true,
            user: userData.user,
            isLoading: false,
            error: null,
            authType: userData.user.walletAddress ? 'wallet' : 'email',
          });
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };
  
  /**
   * Login with wallet signature
   */
  const loginWithWallet = async (
    signature: string,
    message: string,
    walletAddress: string
  ): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          message,
          walletAddress,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.tokens) {
        storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
        
        setState({
          isAuthenticated: true,
          user: data.user,
          isLoading: false,
          error: null,
          authType: 'wallet',
        });
        
        setupRefreshInterval();
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.message || 'Login failed',
        }));
        return false;
      }
    } catch (error) {
      console.error('Wallet login error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Login failed',
      }));
      return false;
    }
  };
  
  /**
   * Login with email and password
   */
  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/email/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (data.success && data.tokens) {
        storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
        
        setState({
          isAuthenticated: true,
          user: data.user,
          isLoading: false,
          error: null,
          authType: 'email',
        });
        
        setupRefreshInterval();
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.message || 'Login failed',
        }));
        return false;
      }
    } catch (error) {
      console.error('Email login error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Login failed',
      }));
      return false;
    }
  };
  
  /**
   * Register with email and password
   */
  const register = async (email: string, password: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/email/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: data.success ? null : (data.message || 'Registration failed'),
      }));
      
      return data.success;
    } catch (error) {
      console.error('Registration error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Registration failed',
      }));
      return false;
    }
  };
  
  /**
   * Logout user
   */
  const logout = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Get access token
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      
      if (accessToken) {
        // Call logout endpoint
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      }
      
      // Clear tokens
      clearTokens();
      
      // Clear refresh interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      
      // Reset state
      setState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        authType: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      
      // Still clear tokens and reset state on error
      clearTokens();
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      
      setState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        authType: null,
      });
    }
  };
  
  /**
   * Verify email with token
   */
  const verifyEmailToken = async (token: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch(`/api/auth/email/verify/${token}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: data.success ? null : (data.message || 'Email verification failed'),
      }));
      
      return data.success;
    } catch (error) {
      console.error('Email verification error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Email verification failed',
      }));
      return false;
    }
  };
  
  /**
   * Resend verification email
   */
  const resendVerificationEmail = async (): Promise<boolean> => {
    try {
      if (!state.isAuthenticated || !state.user) {
        setState(prev => ({
          ...prev,
          error: 'You must be logged in to resend verification email',
        }));
        return false;
      }
      
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Get access token
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      
      if (!accessToken) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('/api/auth/email/resend-verification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: data.success ? null : (data.message || 'Failed to resend verification email'),
      }));
      
      return data.success;
    } catch (error) {
      console.error('Resend verification email error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to resend verification email',
      }));
      return false;
    }
  };
  
  /**
   * Request password reset
   */
  const requestPasswordReset = async (email: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/email/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: data.success ? null : (data.message || 'Password reset request failed'),
      }));
      
      return data.success;
    } catch (error) {
      console.error('Password reset request error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Password reset request failed',
      }));
      return false;
    }
  };
  
  /**
   * Reset password with token
   */
  const resetPassword = async (token: string, newPassword: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch(`/api/auth/email/reset-password/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      });
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: data.success ? null : (data.message || 'Password reset failed'),
      }));
      
      return data.success;
    } catch (error) {
      console.error('Password reset error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Password reset failed',
      }));
      return false;
    }
  };
  
  /**
   * Change password (authenticated)
   */
  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      if (!state.isAuthenticated || !state.user) {
        setState(prev => ({
          ...prev,
          error: 'You must be logged in to change password',
        }));
        return false;
      }
      
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Get access token
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      
      if (!accessToken) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('/api/auth/email/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: data.success ? null : (data.message || 'Password change failed'),
      }));
      
      return data.success;
    } catch (error) {
      console.error('Password change error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Password change failed',
      }));
      return false;
    }
  };
  
  // Context value
  const contextValue: AuthContextType = {
    ...state,
    loginWithWallet,
    loginWithEmail,
    register,
    logout,
    refreshToken,
    verifyEmailToken,
    resendVerificationEmail,
    requestPasswordReset,
    resetPassword,
    changePassword,
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for using the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;