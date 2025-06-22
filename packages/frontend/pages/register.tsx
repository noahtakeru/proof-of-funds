/**
 * Register Page
 * 
 * Allows users to create a new account with email and password.
 * Redirects authenticated users to the home page.
 */

import React, { useEffect, useState } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import RegisterForm from '../components/auth/RegisterForm';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage: NextPage = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    // Redirect authenticated users to home page
    if (isAuthenticated && !isLoading) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleRegisterSuccess = () => {
    // Show success message
    setShowSuccessMessage(true);

    // Redirect to login page after a delay
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  };

  const handleCancel = () => {
    router.push('/');
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <>
        <Head>
          <title>Register - Proof of Funds</title>
        </Head>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </>
    );
  }

  // Don't render register form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Register - Proof of Funds</title>
      </Head>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md">
            {showSuccessMessage ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-green-800 mb-2">Registration Successful!</h2>
                <p className="text-green-700 mb-4">
                  Please check your email to verify your account before logging in.
                </p>
                <p className="text-green-600 text-sm">
                  Redirecting to login page...
                </p>
              </div>
            ) : (
              <>
                <RegisterForm
                  onSuccess={handleRegisterSuccess}
                  onCancel={handleCancel}
                />

                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Already have an account?{' '}
                    <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                      Sign in
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterPage;