/**
 * Login Form Component
 * 
 * Provides a form for users to login with either wallet or email/password.
 */

import React, { useState } from 'react';
import { useAuthentication } from '../../hooks/useAuthentication';
import { useWallet } from '../../hooks/useWallet';

interface LoginFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  defaultTab?: 'wallet' | 'email';
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onCancel,
  defaultTab = 'wallet'
}) => {
  // Hooks
  const { loginWithEmail, error: authError } = useAuthentication();
  const { connect: connectWallet, isConnecting, connectionError } = useWallet();
  
  // Form state
  const [activeTab, setActiveTab] = useState<'wallet' | 'email'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Combined error from all sources
  const combinedError = error || authError || connectionError;
  
  /**
   * Handle wallet login
   */
  const handleWalletLogin = async () => {
    try {
      setError(null);
      setSuccessMessage(null);
      
      const { success, address } = await connectWallet();
      
      if (success && address) {
        setSuccessMessage(`Successfully connected wallet ${address.substring(0, 6)}...${address.substring(address.length - 4)}`);
        if (onSuccess) onSuccess();
      } else {
        setError('Failed to connect wallet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };
  
  /**
   * Handle email login form submission
   */
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      
      // Validate inputs
      if (!email || !password) {
        setError('Email and password are required');
        return;
      }
      
      const success = await loginWithEmail(email, password);
      
      if (success) {
        setSuccessMessage('Login successful');
        setEmail('');
        setPassword('');
        if (onSuccess) onSuccess();
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Login to Proof of Funds</h2>
      
      {/* Tab selector */}
      <div className="flex mb-6 border-b">
        <button
          className={`flex-1 py-2 font-medium text-center ${activeTab === 'wallet' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('wallet')}
        >
          Wallet
        </button>
        <button
          className={`flex-1 py-2 font-medium text-center ${activeTab === 'email' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('email')}
        >
          Email
        </button>
      </div>
      
      {/* Error message */}
      {combinedError && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
          {combinedError}
        </div>
      )}
      
      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4">
          {successMessage}
        </div>
      )}
      
      {/* Wallet login */}
      {activeTab === 'wallet' && (
        <div>
          <p className="text-gray-600 mb-6 text-center">
            Connect your wallet to authenticate and access your proofs
          </p>
          
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center transition-colors"
            onClick={handleWalletLogin}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>
          
          <p className="text-sm text-gray-500 mt-4 text-center">
            Supports MetaMask, WalletConnect, and other Ethereum wallets
          </p>
        </div>
      )}
      
      {/* Email login */}
      {activeTab === 'email' && (
        <form onSubmit={handleEmailLogin}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex justify-end mt-2">
              <a href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
                Forgot Password?
              </a>
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
          
          <p className="text-sm text-gray-600 mt-4 text-center">
            Don't have an account?{' '}
            <a href="/register" className="text-blue-600 hover:text-blue-800">
              Sign up
            </a>
          </p>
        </form>
      )}
      
      {/* Cancel button */}
      {onCancel && (
        <div className="mt-4 text-center">
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginForm;