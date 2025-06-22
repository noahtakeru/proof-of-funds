/**
 * Login Page
 * 
 * Provides user authentication through email/password or wallet connection.
 * Redirects authenticated users to the home page.
 */

import React, { useEffect } from 'react';
import { GetServerSideProps, NextPage } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import LoginForm from '../components/auth/LoginForm';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
  redirect?: string;
}

const LoginPage: NextPage<LoginPageProps> = ({ redirect }) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Redirect authenticated users to home or specified redirect path
    if (isAuthenticated && !isLoading) {
      const redirectPath = redirect || router.query.redirect || '/';
      router.push(redirectPath as string);
    }
  }, [isAuthenticated, isLoading, router, redirect]);

  const handleLoginSuccess = () => {
    // Redirect to the specified path or home
    const redirectPath = redirect || router.query.redirect || '/';
    router.push(redirectPath as string);
  };

  const handleCancel = () => {
    router.push('/');
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <>
        <Head>
          <title>Login - Proof of Funds</title>
        </Head>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </>
    );
  }

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Login - Proof of Funds</title>
      </Head>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md">
            <LoginForm
              onSuccess={handleLoginSuccess}
              onCancel={handleCancel}
              defaultTab="email"
            />

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                New to Proof of Funds?{' '}
                <a href="/register" className="text-blue-600 hover:text-blue-800 font-medium">
                  Create an account
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Server-side props to check authentication status
export const getServerSideProps: GetServerSideProps = async (context) => {
  // Get redirect URL from query params
  const redirect = context.query.redirect as string | undefined;

  return {
    props: {
      redirect: redirect || null
    }
  };
};

export default LoginPage;