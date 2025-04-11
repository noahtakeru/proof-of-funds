import Link from 'next/link';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-gray-100 py-8 mt-12">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="mb-4 md:mb-0">
                        <p className="text-gray-600 text-sm">
                            © {currentYear} Arbitr. All rights reserved.
                        </p>
                    </div>
                    <div className="flex space-x-6">
                        <Link href="/terms-of-service" className="text-gray-600 hover:text-gray-900 text-sm">
                            Terms of Service
                        </Link>
                        <Link href="/privacy-policy" className="text-gray-600 hover:text-gray-900 text-sm">
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
} 