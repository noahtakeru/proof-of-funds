/**
 * User Profile Dropdown
 * 
 * Displays user info and provides access to account-related actions.
 */

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';

const UserProfileDropdown: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  /**
   * Handle logout
   */
  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    router.push('/');
  };
  
  // If not authenticated, show login/register links
  if (!isAuthenticated) {
    return (
      <div className="flex space-x-2">
        <Link href="/login">
          <a className="inline-block px-4 py-2 text-sm text-blue-600 hover:text-blue-800">
            Login
          </a>
        </Link>
        <Link href="/register">
          <a className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Register
          </a>
        </Link>
      </div>
    );
  }
  
  // Get address display for UI
  const displayAddress = user?.walletAddress
    ? `${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}`
    : null;
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
          {user?.email ? user.email[0].toUpperCase() : 'U'}
        </div>
        <span className="ml-2 text-gray-700 dark:text-gray-300">
          {user?.email || displayAddress || 'User'}
        </span>
        <svg className="ml-1 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100">
          <div className="px-4 py-3">
            <p className="text-sm text-gray-500">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.email || displayAddress || 'Unknown'}
            </p>
          </div>
          
          <div className="py-1">
            <Link href="/dashboard">
              <a className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setIsOpen(false)}>
                Dashboard
              </a>
            </Link>
            <Link href="/settings">
              <a className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setIsOpen(false)}>
                Settings
              </a>
            </Link>
          </div>
          
          <div className="py-1">
            <button
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;