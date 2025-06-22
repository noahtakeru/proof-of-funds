/**
 * Email Verification Page
 * 
 * Handles email verification tokens from verification links.
 * Automatically verifies the email and redirects to login.
 */

import React, { useEffect, useState } from 'react';
import { GetServerSideProps, NextPage } from 'next';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import VerifyEmailPage from '../components/auth/VerifyEmailPage';
import { useAuth } from '../contexts/AuthContext';

interface VerifyEmailPageProps {
  token?: string;
}

const EmailVerificationPage: NextPage<VerifyEmailPageProps> = ({ token }) => {
  const router = useRouter();
  const { verifyEmailToken } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  
  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setVerificationStatus('error');
        setErrorMessage('No verification token provided');
        return;
      }
      
      try {
        const success = await verifyEmailToken(token);
        
        if (success) {
          setVerificationStatus('success');
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        } else {
          setVerificationStatus('error');
          setErrorMessage('Invalid or expired verification token');
        }
      } catch (error) {
        setVerificationStatus('error');
        setErrorMessage('An error occurred during verification');
      }
    };
    
    verifyEmail();
  }, [token, verifyEmailToken, router]);
  
  return (
    <Layout title="Verify Email - Proof of Funds">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md">
            {verificationStatus === 'verifying' && (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Verifying Email</h2>
                <p className="text-gray-600">
                  Please wait while we verify your email address...
                </p>
              </div>
            )}
            
            {verificationStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-green-800 mb-2">Email Verified!</h2>
                <p className="text-green-700 mb-4">
                  Your email has been successfully verified. You can now log in to your account.
                </p>
                <p className="text-green-600 text-sm">
                  Redirecting to login page...
                </p>
              </div>
            )}
            
            {verificationStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-red-800 mb-2">Verification Failed</h2>
                <p className="text-red-700 mb-6">
                  {errorMessage}
                </p>
                <div className="space-y-3">
                  <a 
                    href="/register" 
                    className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Register Again
                  </a>
                  <a 
                    href="/login" 
                    className="inline-block w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Go to Login
                  </a>
                </div>
              </div>
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
  
  return {
    props: {
      token: token || null
    }
  };
};

export default EmailVerificationPage;