import Head from 'next/head';
import Layout from '../components/Layout';

export default function PrivacyPolicy() {
    return (
        <Layout title="Privacy Policy - Arbitr Proof of Funds">
            <div className="mt-8 mb-16">
                <div className="bg-white p-8 rounded-lg shadow-md mb-8">
                    <h1 className="text-3xl font-bold mb-2 text-center text-primary-600">Privacy Policy</h1>
                    <div className="w-16 h-1 bg-primary-500 mx-auto my-6 rounded"></div>

                    <p className="mb-8 text-gray-600 text-sm text-center">Last updated: {new Date().toLocaleDateString()}</p>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">1. Introduction</h2>
                        <p className="mb-4 text-gray-700">
                            Arbitr ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Proof of Funds platform ("Service").
                        </p>
                        <p className="mb-4 text-gray-700">
                            We take your privacy seriously and have implemented advanced cryptographic technologies to enhance privacy protection for our users. Please read this Privacy Policy carefully to understand our practices regarding your data.
                        </p>
                        <p className="mb-4 text-gray-700">
                            By accessing or using our Service, you consent to the data practices described in this Privacy Policy. If you do not agree with the data practices described in this policy, you should not use our Service.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">2. Information We Collect</h2>
                        <p className="mb-4 text-gray-700">
                            Our Service collects several types of information, using different methods and for various purposes:
                        </p>

                        <h3 className="text-lg font-medium mt-6 mb-3 text-gray-800">2.1 Wallet Information</h3>
                        <p className="mb-4 text-gray-700">
                            When you connect your blockchain wallet to our Service, we may collect:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Public wallet addresses (for standard proofs)</li>
                            <li>Wallet balances and transaction information (necessary for proof generation)</li>
                            <li>Digital signatures created by your wallet</li>
                            <li>Connected blockchain network information</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            <strong>Important Note:</strong> We never collect, store, or have access to your private keys, seed phrases, or other wallet credentials that could be used to access your funds.
                        </p>

                        <h3 className="text-lg font-medium mt-6 mb-3 text-gray-800">2.2 Proof Data</h3>
                        <p className="mb-4 text-gray-700">
                            When you generate a proof using our Service, we collect and process:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>The type of proof requested</li>
                            <li>Amount or threshold values specified</li>
                            <li>Cryptographic data necessary for verification</li>
                            <li>Blockchain transaction data related to proof submission</li>
                            <li>System-generated data for privacy-preserving proofs</li>
                            <li>Proof expiration parameters</li>
                        </ul>

                        <h3 className="text-lg font-medium mt-6 mb-3 text-gray-800">2.3 Technical Data</h3>
                        <p className="mb-4 text-gray-700">
                            We automatically collect certain technical information when you use our Service:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>IP address</li>
                            <li>Browser type and version</li>
                            <li>Device information and identifiers</li>
                            <li>Operating system</li>
                            <li>Time zone and general location</li>
                            <li>Browser capabilities</li>
                            <li>Service usage data and analytics</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">3. How We Use Your Information</h2>
                        <p className="mb-4 text-gray-700">
                            We use the information we collect for various purposes, including:
                        </p>

                        <h3 className="text-lg font-medium mt-6 mb-3 text-gray-800">3.1 Core Service Functionality</h3>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Generating and verifying proofs of funds</li>
                            <li>Processing wallet connections and signatures</li>
                            <li>Creating and managing privacy-preserving proofs</li>
                            <li>Managing system infrastructure for proof submission</li>
                            <li>Enabling blockchain transactions necessary for the Service</li>
                            <li>Maintaining proof expiration and verification systems</li>
                        </ul>

                        <h3 className="text-lg font-medium mt-6 mb-3 text-gray-800">3.2 Service Improvement and Analytics</h3>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Analyzing usage patterns to improve our Service</li>
                            <li>Detecting and troubleshooting technical issues</li>
                            <li>Optimizing the performance of our systems</li>
                            <li>Enhancing the user experience</li>
                            <li>Developing new features and services</li>
                        </ul>

                        <h3 className="text-lg font-medium mt-6 mb-3 text-gray-800">3.3 Security and Compliance</h3>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Detecting and preventing fraudulent activities</li>
                            <li>Protecting against security breaches</li>
                            <li>Ensuring the integrity of our Service</li>
                            <li>Complying with legal obligations</li>
                            <li>Enforcing our Terms of Service</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">4. Privacy Technology</h2>
                        <p className="mb-4 text-gray-700">
                            Our Service incorporates advanced privacy technology to enhance your security. This allows us to verify information while minimizing data exposure. When you use our privacy-preserving features:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Your wallet address is protected from unnecessary disclosure</li>
                            <li>Our systems employ secure methods for processing data</li>
                            <li>Verification can occur with enhanced privacy</li>
                            <li>Data is protected using industry-standard security practices</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            While our technology significantly enhances privacy, it is important to understand that no system can guarantee absolute privacy. Blockchain transactions are public by nature, and sophisticated analysis techniques may potentially identify patterns or connections in some circumstances.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">5. Information Storage and Security</h2>
                        <p className="mb-4 text-gray-700">
                            We implement a variety of security measures to maintain the safety of your information:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Industry-standard encryption for sensitive data storage</li>
                            <li>Secure key management practices</li>
                            <li>Cryptographic verification for data integrity</li>
                            <li>Secure execution environments for sensitive operations</li>
                            <li>Regular security audits and vulnerability assessments</li>
                            <li>Secure infrastructure management</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            We store your information only for as long as necessary to provide our Service, comply with legal obligations, resolve disputes, and enforce our agreements. Proof data is retained according to the expiration parameters you select during creation.
                        </p>
                        <p className="mb-4 text-gray-700">
                            Despite our security measures, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security of your information.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">6. Information Sharing and Disclosure</h2>
                        <p className="mb-4 text-gray-700">
                            We may share your information in the following circumstances:
                        </p>

                        <h3 className="text-lg font-medium mt-6 mb-3 text-gray-800">6.1 Proof Verification</h3>
                        <p className="mb-4 text-gray-700">
                            When you create a proof and share it with a verifier, certain information is disclosed:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>For standard proofs: Your wallet address may be visible to the verifier</li>
                            <li>For privacy-preserving proofs: The verifier can see the proof result with enhanced privacy</li>
                            <li>All verifiers can see the proof parameters (type, amount/threshold, expiration)</li>
                            <li>Blockchain transaction data is publicly visible on the respective networks</li>
                        </ul>

                        <h3 className="text-lg font-medium mt-6 mb-3 text-gray-800">6.2 Service Providers</h3>
                        <p className="mb-4 text-gray-700">
                            We may employ third-party companies and individuals to facilitate our Service ("Service Providers"), provide the Service on our behalf, perform Service-related services, or assist us in analyzing how our Service is used. These third parties may have access to your information only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">7. Contact Us</h2>
                        <p className="mb-4 text-gray-700">
                            If you have any questions about our Privacy Policy, please contact us at <a href="mailto:privacy@arbitr.io" className="text-primary-600 hover:underline">privacy@arbitr.io</a>.
                        </p>
                    </section>
                </div>
            </div>
        </Layout>
    );
} 