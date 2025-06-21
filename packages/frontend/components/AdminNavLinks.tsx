/**
 * Admin Navigation Links Component
 * 
 * Provides navigation links for admin users.
 */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

const AdminNavLinks: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  
  // Check if user has admin permission
  const isAdmin = user?.permissions?.includes('ADMIN');
  
  // If not admin, don't render anything
  if (!isAdmin) {
    return null;
  }
  
  /**
   * Get active class for the current route
   */
  const getActiveClass = (href: string): string => {
    const isActive = router.pathname === href;
    return isActive 
      ? 'text-primary-600 border-primary-600 border-b-2' 
      : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300';
  };
  
  return (
    <>
      <Link href="/admin/security-dashboard">
        <a className={getActiveClass('/admin/security-dashboard')}>
          Security Dashboard
        </a>
      </Link>
    </>
  );
};

export default AdminNavLinks;