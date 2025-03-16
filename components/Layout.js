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

                <main className="flex-grow container mx-auto py-8 px-4">
                    {children}
                </main>

                <footer className="bg-gray-100 py-6">
                    <div className="container mx-auto px-4 text-center text-gray-600">
                        <p>© 2024 Proof of Funds on Polygon | <a href="https://polygon.technology/" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Polygon Technology</a></p>
                    </div>
                </footer>
            </div>
        </>
    );
} 