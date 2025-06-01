/**
 * Verify Email Page Component
 * 
 * Handles email verification when user clicks the verification link.
 */

import React, { useState, useEffect } from 'react';
import { useAuthentication } from '../../hooks/useAuthentication';

interface VerifyEmailPageProps {
  token: string;
}

const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({
  token
}) => {
  // Auth hook
  const { verifyEmailToken, error: authError } = useAuthentication();
  
  // State
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  
  // Combined error from all sources
  const combinedError = error || authError;
  
  // Verify on mount
  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError('Invalid or missing verification token');
        setIsVerifying(false);
        return;
      }
      
      try {
        const success = await verifyEmailToken(token);
        
        if (success) {
          setVerified(true);
        } else {
          setError('Email verification failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Email verification failed');
      } finally {
        setIsVerifying(false);
      }
    };
    
    verify();
  }, [token, verifyEmailToken]);
  
  // Show loading during verification
  if (isVerifying) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Verifying Your Email</h2>
        <div className="flex justify-center my-6">
          <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-gray-600">
          Please wait while we verify your email address...
        </p>
      </div>
    );
  }
  
  // Show success message
  if (verified) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto text-center">
        <div className="text-green-500 mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Email Verified!</h2>
        <p className="text-gray-600 mb-6">
          Your email has been successfully verified. You can now login to your account.
        </p>
        <a
          href="/login"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          Go to Login
        </a>
      </div>
    );
  }
  
  // Show error message
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto text-center">
      <div className="text-red-500 mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold mb-2 text-gray-800">Verification Failed</h2>
      <div className="bg-red-50 text-red-700 p-3 rounded-md mb-6">
        {combinedError || 'Unable to verify your email. The verification link may be expired or invalid.'}
      </div>
      <p className="text-gray-600 mb-6">
        Please try logging in or request a new verification email.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <a
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-center"
        >
          Go to Login
        </a>
        <a
          href="/resend-verification"
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md transition-colors text-center"
        >
          Resend Verification
        </a>
      </div>
    </div>
  );
};

export default VerifyEmailPage;