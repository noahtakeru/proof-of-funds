/**
 * Reset Password Page
 * 
 * Allows users to reset their password using a token from the reset email.
 * Redirects authenticated users to the home page.
 */

import React, { useEffect, useState } from 'react';
import { GetServerSideProps, NextPage } from 'next';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ResetPasswordForm from '../components/auth/ResetPasswordForm';
import { useAuth } from '../contexts/AuthContext';

interface ResetPasswordPageProps {
  token?: string;
}

const ResetPasswordPage: NextPage<ResetPasswordPageProps> = ({ token }) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  useEffect(() => {
    // Redirect authenticated users to home page
    if (isAuthenticated && !isLoading) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);
  
  useEffect(() => {
    // If no token is provided, redirect to forgot password page
    if (!token && !isLoading) {
      router.push('/forgot-password');
    }
  }, [token, isLoading, router]);
  
  const handleResetSuccess = () => {
    setShowSuccessMessage(true);
    
    // Redirect to login after 3 seconds
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  };
  
  const handleCancel = () => {
    router.push('/login');
  };
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <Layout title="Reset Password - Proof of Funds">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }
  
  // Don't render form if already authenticated or no token
  if (isAuthenticated || !token) {
    return null;
  }
  
  return (
    <Layout title="Reset Password - Proof of Funds">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md">
            {showSuccessMessage ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-green-800 mb-2">Password Reset Successful!</h2>
                <p className="text-green-700 mb-4">
                  Your password has been successfully reset. You can now log in with your new password.
                </p>
                <p className="text-green-600 text-sm">
                  Redirecting to login page...
                </p>
              </div>
            ) : (
              <>
                <ResetPasswordForm 
                  token={token}
                  onSuccess={handleResetSuccess}
                  onCancel={handleCancel}
                />
                
                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Need a new reset link?{' '}
                    <a href="/forgot-password" className="text-blue-600 hover:text-blue-800 font-medium">
                      Request again
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

// Server-side props to get token from query params
export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.query.token as string | undefined;
  
  // If no token provided, redirect to forgot password page
  if (!token) {
    return {
      redirect: {
        destination: '/forgot-password',
        permanent: false,
      },
    };
  }
  
  return {
    props: {
      token
    }
  };
};

export default ResetPasswordPage;