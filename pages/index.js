import Link from 'next/link';

export default function Home() {
    return (
        <div className="max-w-4xl mx-auto text-center mt-8 mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">Proof of Funds on Polygon</h1>
            <p className="text-xl text-gray-600 mb-8">
                Securely verify your blockchain assets with privacy-preserving proofs
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <div className="card text-left">
                    <h2 className="text-2xl font-semibold mb-3 text-primary-600">Create Proof</h2>
                    <p className="text-gray-600 mb-4">
                        Generate cryptographic proof of your funds on the Polygon network without revealing your exact balance.
                    </p>
                    <Link
                        href="/create"
                        className="btn btn-primary inline-block"
                    >
                        Create Proof
                    </Link>
                </div>

                <div className="card text-left">
                    <h2 className="text-2xl font-semibold mb-3 text-primary-600">Verify Proof</h2>
                    <p className="text-gray-600 mb-4">
                        Verify a proof that someone else has shared with you to confirm their financial capacity.
                    </p>
                    <Link
                        href="/verify"
                        className="btn btn-primary inline-block"
                    >
                        Verify Proof
                    </Link>
                </div>
            </div>

            <div className="card text-left mb-12">
                <h2 className="text-2xl font-semibold mb-4">How It Works</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xl font-bold mb-3">1</div>
                        <h3 className="text-lg font-medium mb-2">Connect Wallet</h3>
                        <p className="text-gray-600 text-center">Connect your Polygon wallet that contains the assets you want to prove.</p>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xl font-bold mb-3">2</div>
                        <h3 className="text-lg font-medium mb-2">Create Proof</h3>
                        <p className="text-gray-600 text-center">Select the type of proof you need and sign the transaction.</p>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xl font-bold mb-3">3</div>
                        <h3 className="text-lg font-medium mb-2">Share Proof</h3>
                        <p className="text-gray-600 text-center">Share your proof with third parties for verification.</p>
                    </div>
                </div>
            </div>

            <div className="bg-primary-50 rounded-lg px-6 py-8 flex flex-col items-center mb-16">
                <h2 className="text-2xl font-semibold mb-4">Ready to get started?</h2>
                <p className="text-gray-600 mb-6">Create your first proof of funds on Polygon in minutes</p>
                <Link
                    href="/create"
                    className="btn btn-primary"
                >
                    Create Your First Proof
                </Link>
            </div>
        </div>
    );
} 