/**
 * Authentication Guard Component
 * 
 * Protects routes that require authentication.
 * Redirects unauthenticated users to login.
 */

import { useRouter } from 'next/router';
import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  fallbackUrl?: string;
}

const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requiredPermissions = [],
  fallbackUrl = '/login'
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // Skip during loading state to avoid flash of redirect
    if (isLoading) return;
    
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.push({
        pathname: fallbackUrl,
        query: { redirect: router.asPath }
      });
      return;
    }
    
    // If permissions required, check them
    if (requiredPermissions.length > 0 && user) {
      const hasAllPermissions = requiredPermissions.every(
        permission => user.permissions.includes(permission)
      );
      
      if (!hasAllPermissions) {
        // Redirect to unauthorized page or dashboard
        router.push('/unauthorized');
      }
    }
  }, [isAuthenticated, isLoading, user, router, fallbackUrl, requiredPermissions]);
  
  // Show loading or unauthorized UI if needed
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null; // Render nothing while redirecting
  }
  
  // If permissions check is needed and user data is loaded, check permissions
  if (requiredPermissions.length > 0 && user) {
    const hasAllPermissions = requiredPermissions.every(
      permission => user.permissions.includes(permission)
    );
    
    if (!hasAllPermissions) {
      return null; // Render nothing while redirecting to unauthorized page
    }
  }
  
  // Render the protected content
  return <>{children}</>;
};

export default AuthGuard;