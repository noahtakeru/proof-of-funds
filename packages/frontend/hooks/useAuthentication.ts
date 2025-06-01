/**
 * Authentication Hook
 * 
 * Custom hook for handling authentication actions and state.
 * Provides a simplified interface for working with the auth context.
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ethers } from 'ethers';

/**
 * Hook to handle authentication-related actions
 */
export function useAuthentication() {
  const auth = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  /**
   * Connect and login with wallet
   * @returns Success status and address if successful
   */
  const connectWallet = async (): Promise<{ success: boolean; address?: string }> => {
    try {
      setIsLoggingIn(true);

      // Check if ethereum is available (MetaMask or similar)
      if (!window.ethereum) {
        throw new Error('No Ethereum provider found. Please install MetaMask or another wallet.');
      }

      // Request accounts
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      // Create a challenge message with timestamp to prevent replay attacks
      const timestamp = Date.now();
      const nonce = Math.floor(Math.random() * 1000000);
      const message = `Sign this message to authenticate with Proof of Funds.\n\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

      // Sign the message
      const signature = await signer.signMessage(message);

      // Login with the signature
      const success = await auth.loginWithWallet(signature, message, address);

      return {
        success,
        address: success ? address : undefined
      };
    } catch (error) {
      console.error('Wallet connection error:', error);
      return { success: false };
    } finally {
      setIsLoggingIn(false);
    }
  };

  /**
   * Login with email and password
   * @param email User email
   * @param password User password
   * @returns Success status
   */
  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoggingIn(true);
      return await auth.loginWithEmail(email, password);
    } catch (error) {
      console.error('Email login error:', error);
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  };

  /**
   * Register a new user with email and password
   * @param email User email
   * @param password User password
   * @returns Success status
   */
  const register = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsRegistering(true);
      return await auth.register(email, password);
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    } finally {
      setIsRegistering(false);
    }
  };

  /**
   * Logout the current user
   */
  const logout = async (): Promise<void> => {
    await auth.logout();
  };

  /**
   * Verify email with token
   * @param token Verification token
   * @returns Success status
   */
  const verifyEmail = async (token: string): Promise<boolean> => {
    try {
      setIsVerifying(true);
      return await auth.verifyEmailToken(token);
    } catch (error) {
      console.error('Email verification error:', error);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Resend verification email
   * @returns Success status
   */
  const resendVerificationEmail = async (): Promise<boolean> => {
    try {
      setIsVerifying(true);
      return await auth.resendVerificationEmail();
    } catch (error) {
      console.error('Resend verification error:', error);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Request password reset for an email
   * @param email User email
   * @returns Success status
   */
  const requestPasswordReset = async (email: string): Promise<boolean> => {
    try {
      setIsResetting(true);
      return await auth.requestPasswordReset(email);
    } catch (error) {
      console.error('Password reset request error:', error);
      return false;
    } finally {
      setIsResetting(false);
    }
  };

  /**
   * Reset password with token
   * @param token Reset token
   * @param newPassword New password
   * @returns Success status
   */
  const resetPassword = async (token: string, newPassword: string): Promise<boolean> => {
    try {
      setIsResetting(true);
      return await auth.resetPassword(token, newPassword);
    } catch (error) {
      console.error('Password reset error:', error);
      return false;
    } finally {
      setIsResetting(false);
    }
  };

  /**
   * Change password (for authenticated users)
   * @param currentPassword Current password
   * @param newPassword New password
   * @returns Success status
   */
  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      setIsResetting(true);
      return await auth.changePassword(currentPassword, newPassword);
    } catch (error) {
      console.error('Password change error:', error);
      return false;
    } finally {
      setIsResetting(false);
    }
  };

  return {
    // Authentication state
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    isLoading: auth.isLoading,
    error: auth.error,
    authType: auth.authType,
    
    // Process states
    isLoggingIn,
    isRegistering,
    isVerifying,
    isResetting,
    
    // Authentication methods
    connectWallet,
    loginWithEmail,
    register,
    logout,
    verifyEmail,
    resendVerificationEmail,
    requestPasswordReset,
    resetPassword,
    changePassword
  };
}

export default useAuthentication;