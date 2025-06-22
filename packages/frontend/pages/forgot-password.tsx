/**
 * Forgot Password Page
 * 
 * Allows users to request a password reset link via email.
 * Redirects authenticated users to the home page.
 */

import React, { useEffect, useState } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm';
import { useAuth } from '../contexts/AuthContext';

const ForgotPasswordPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  useEffect(() => {
    // Redirect authenticated users to home page
    if (isAuthenticated && !isLoading) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);
  
  const handleRequestSuccess = (email: string) => {
    setUserEmail(email);
    setShowSuccessMessage(true);
  };
  
  const handleCancel = () => {
    router.push('/login');
  };
  
  const handleBackToLogin = () => {
    router.push('/login');
  };
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <Layout title="Forgot Password - Proof of Funds">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }
  
  // Don't render form if already authenticated
  if (isAuthenticated) {
    return null;
  }
  
  return (
    <Layout title="Forgot Password - Proof of Funds">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md">
            {showSuccessMessage ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h2 className="text-2xl font-bold text-green-800 mb-2">Check Your Email</h2>
                <p className="text-green-700 mb-4">
                  We've sent a password reset link to <strong>{userEmail}</strong>
                </p>
                <p className="text-green-600 text-sm mb-6">
                  Please check your email and follow the instructions to reset your password. 
                  The link will expire in 24 hours.
                </p>
                <button
                  onClick={handleBackToLogin}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <ForgotPasswordForm 
                  onSuccess={handleRequestSuccess}
                  onCancel={handleCancel}
                />
                
                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Remember your password?{' '}
                    <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                      Back to login
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPasswordPage;