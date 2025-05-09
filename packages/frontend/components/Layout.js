/**
 * Layout Component
 * 
 * Provides a consistent page structure across the entire Arbitr application.
 * This component wraps all pages with common elements including:
 * 
 * - Document head with title and meta tags
 * - Navigation bar for site-wide navigation
 * - Main content area with appropriate spacing and container sizing
 * - Footer with copyright information and external links
 * 
 * The layout uses a flex column design to ensure the footer stays at the bottom
 * of the page even when content doesn't fill the entire viewport height.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Page content to be rendered within the layout
 * @param {string} props.title - Document title (defaults to "Proof of Funds - Polygon")
 */

import Head from 'next/head';
import Navbar from './Navbar';

export default function Layout({ children, title = 'Proof of Funds - Polygon' }) {
    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content="Proof of Funds on Polygon Amoy testnet" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className="min-h-screen flex flex-col">
                <Navbar />

                <main className="flex-grow container mx-auto py-8 px-4 mb-10">
                    {children}
                </main>

                <footer className="bg-gray-100 py-6 mt-6">
                    <div className="container mx-auto px-4 text-center text-gray-600">
                        <p>© 2025 Proof of Funds on Polygon | <a href="https://polygon.technology/" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Polygon Technology</a></p>
                    </div>
                </footer>
            </div>
        </>
    );
} 