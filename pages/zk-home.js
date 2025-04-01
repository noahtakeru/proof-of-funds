/**
 * Zero-Knowledge Home Page (Redirect)
 * 
 * This page redirects to the main home page.
 * It exists for backward compatibility with any existing links.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

// This functionality is now integrated into the main pages
// This file exists for backward compatibility
export default function ZKHome() {
    const router = useRouter();
    
    // Redirect to the main home page
    useEffect(() => {
        router.push({
            pathname: '/'
        });
    }, [router]);
    
    // Return loading state while redirecting
    return (
        <Layout title="Redirecting...">
            <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Redirecting to the home page...</p>
            </div>
        </Layout>
    );
}