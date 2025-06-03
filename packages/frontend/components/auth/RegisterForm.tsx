/**
 * Register Form Component
 * 
 * Provides a form for users to register with email/password.
 */

import React, { useState } from 'react';
import { useAuthentication } from '../../hooks/useAuthentication';

interface RegisterFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onCancel
}) => {
  // Auth hook
  const { register, error: authError } = useAuthentication();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Password strength validation
  const [passwordStrength, setPasswordStrength] = useState(0);
  const passwordStrengthText = [
    'Too weak',
    'Could be stronger',
    'Good strength',
    'Strong password'
  ];
  const passwordStrengthColor = [
    'bg-red-500',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-green-500'
  ];
  
  // Combined error from all sources
  const combinedError = error || authError;
  
  /**
   * Calculate password strength
   * @param password Password to check
   */
  const calculatePasswordStrength = (password: string): number => {
    if (!password) {return 0;}
    
    let score = 0;
    
    // Length check
    if (password.length >= 8) {score += 1;}
    if (password.length >= 12) {score += 1;}
    
    // Complexity checks
    if (/[A-Z]/.test(password)) {score += 1;}
    if (/[a-z]/.test(password)) {score += 1;}
    if (/[0-9]/.test(password)) {score += 1;}
    if (/[^A-Za-z0-9]/.test(password)) {score += 1;}
    
    // Normalize score to 0-3 range
    return Math.min(3, Math.floor(score / 2));
  };
  
  /**
   * Handle password change and update strength
   */
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordStrength(calculatePasswordStrength(newPassword));
  };
  
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
      
      if (!password) {
        setError('Password is required');
        return;
      }
      
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      if (passwordStrength < 2) {
        setError('Please use a stronger password');
        return;
      }
      
      const success = await register(email, password);
      
      if (success) {
        setSuccessMessage('Registration successful! Please check your email to verify your account.');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        if (onSuccess) {onSuccess();}
      } else {
        setError('Registration failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Create an Account</h2>
      
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
        <div className="mb-4">
          <label htmlFor="register-email" className="block text-gray-700 text-sm font-medium mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="register-email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="register-password" className="block text-gray-700 text-sm font-medium mb-2">
            Password
          </label>
          <input
            type="password"
            id="register-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
            value={password}
            onChange={handlePasswordChange}
            required
          />
          
          {/* Password strength indicator */}
          {password && (
            <div className="mt-2">
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${passwordStrengthColor[passwordStrength]}`}
                  style={{ width: `${(passwordStrength + 1) * 25}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Password strength: {passwordStrengthText[passwordStrength]}
              </p>
              <ul className="text-xs text-gray-500 mt-2 list-disc list-inside">
                <li>At least 8 characters</li>
                <li>Mix of uppercase and lowercase letters</li>
                <li>Include numbers and special characters</li>
              </ul>
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <label htmlFor="confirm-password" className="block text-gray-700 text-sm font-medium mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirm-password"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              confirmPassword && password !== confirmPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Registering...' : 'Register'}
        </button>
        
        <p className="text-sm text-gray-600 mt-4 text-center">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-800">
            Sign in
          </a>
        </p>
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

export default RegisterForm;