/**
 * Forgot Password Form Component
 * 
 * Provides a form for users to request a password reset email.
 */

import React, { useState } from 'react';
import { useAuthentication } from '../../hooks/useAuthentication';

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSuccess,
  onCancel
}) => {
  // Auth hook
  const { requestPasswordReset, error: authError } = useAuthentication();
  
  // Form state
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Combined error from all sources
  const combinedError = error || authError;
  
  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      
      // Validate inputs
      if (!email) {
        setError('Email is required');
        return;
      }
      
      const success = await requestPasswordReset(email);
      
      if (success) {
        setSuccessMessage('If your email is registered, you will receive a password reset link shortly.');
        setEmail('');
        if (onSuccess) {onSuccess();}
      } else {
        setError('Failed to request password reset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset request failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Forgot Password</h2>
      <p className="text-gray-600 mb-6 text-center">
        Enter your email address and we'll send you a link to reset your password.
      </p>
      
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
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
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
        
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Reset Password'}
        </button>
        
        <div className="mt-4 text-center">
          <a href="/login" className="text-blue-600 hover:text-blue-800">
            Return to login
          </a>
        </div>
      </form>
      
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

export default ForgotPasswordForm;