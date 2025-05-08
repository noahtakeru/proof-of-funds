import Head from 'next/head';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>Privacy Policy - Arbitr Proof of Funds</title>
                <meta name="description" content="Privacy Policy for Arbitr Proof of Funds platform" />
            </Head>

            <main className="container mx-auto px-4 py-8 max-w-4xl">
                <h1 className="text-3xl font-bold mb-8 text-center">Privacy Policy</h1>

                <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
                    <p className="mb-4">
                        Arbitr ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Proof of Funds platform ("Service").
                    </p>
                    <p className="mb-4">
                        We take your privacy seriously and have implemented advanced cryptographic technologies to enhance privacy protection for our users. Please read this Privacy Policy carefully to understand our practices regarding your data.
                    </p>
                    <p className="mb-4">
                        By accessing or using our Service, you consent to the data practices described in this Privacy Policy. If you do not agree with the data practices described in this policy, you should not use our Service.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
                    <p className="mb-4">
                        Our Service collects several types of information, using different methods and for various purposes:
                    </p>

                    <h3 className="text-lg font-medium mt-6 mb-3">2.1 Wallet Information</h3>
                    <p className="mb-4">
                        When you connect your blockchain wallet to our Service, we may collect:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Public wallet addresses (for standard proofs)</li>
                        <li className="mb-2">Wallet balances and transaction information (necessary for proof generation)</li>
                        <li className="mb-2">Digital signatures created by your wallet</li>
                        <li className="mb-2">Connected blockchain network information</li>
                    </ul>
                    <p className="mb-4">
                        <strong>Important Note:</strong> We never collect, store, or have access to your private keys, seed phrases, or other wallet credentials that could be used to access your funds.
                    </p>

                    <h3 className="text-lg font-medium mt-6 mb-3">2.2 Proof Data</h3>
                    <p className="mb-4">
                        When you generate a proof using our Service, we collect and process:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">The type of proof requested</li>
                        <li className="mb-2">Amount or threshold values specified</li>
                        <li className="mb-2">Cryptographic data necessary for verification</li>
                        <li className="mb-2">Blockchain transaction data related to proof submission</li>
                        <li className="mb-2">System-generated data for privacy-preserving proofs</li>
                        <li className="mb-2">Proof expiration parameters</li>
                    </ul>

                    <h3 className="text-lg font-medium mt-6 mb-3">2.3 Technical Data</h3>
                    <p className="mb-4">
                        We automatically collect certain technical information when you use our Service:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">IP address</li>
                        <li className="mb-2">Browser type and version</li>
                        <li className="mb-2">Device information and identifiers</li>
                        <li className="mb-2">Operating system</li>
                        <li className="mb-2">Time zone and general location</li>
                        <li className="mb-2">Browser capabilities</li>
                        <li className="mb-2">Service usage data and analytics</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
                    <p className="mb-4">
                        We use the information we collect for various purposes, including:
                    </p>

                    <h3 className="text-lg font-medium mt-6 mb-3">3.1 Core Service Functionality</h3>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Generating and verifying proofs of funds</li>
                        <li className="mb-2">Processing wallet connections and signatures</li>
                        <li className="mb-2">Creating and managing privacy-preserving proofs</li>
                        <li className="mb-2">Managing system infrastructure for proof submission</li>
                        <li className="mb-2">Enabling blockchain transactions necessary for the Service</li>
                        <li className="mb-2">Maintaining proof expiration and verification systems</li>
                    </ul>

                    <h3 className="text-lg font-medium mt-6 mb-3">3.2 Service Improvement and Analytics</h3>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Analyzing usage patterns to improve our Service</li>
                        <li className="mb-2">Detecting and troubleshooting technical issues</li>
                        <li className="mb-2">Optimizing the performance of our systems</li>
                        <li className="mb-2">Enhancing the user experience</li>
                        <li className="mb-2">Developing new features and services</li>
                    </ul>

                    <h3 className="text-lg font-medium mt-6 mb-3">3.3 Security and Compliance</h3>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Detecting and preventing fraudulent activities</li>
                        <li className="mb-2">Protecting against security breaches</li>
                        <li className="mb-2">Ensuring the integrity of our Service</li>
                        <li className="mb-2">Complying with legal obligations</li>
                        <li className="mb-2">Enforcing our Terms of Service</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">4. Privacy Technology</h2>
                    <p className="mb-4">
                        Our Service incorporates advanced privacy technology to enhance your security. This allows us to verify information while minimizing data exposure. When you use our privacy-preserving features:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Your wallet address is protected from unnecessary disclosure</li>
                        <li className="mb-2">Our systems employ secure methods for processing data</li>
                        <li className="mb-2">Verification can occur with enhanced privacy</li>
                        <li className="mb-2">Data is protected using industry-standard security practices</li>
                    </ul>
                    <p className="mb-4">
                        While our technology significantly enhances privacy, it is important to understand that no system can guarantee absolute privacy. Blockchain transactions are public by nature, and sophisticated analysis techniques may potentially identify patterns or connections in some circumstances.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">5. Information Storage and Security</h2>
                    <p className="mb-4">
                        We implement a variety of security measures to maintain the safety of your information:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Industry-standard encryption for sensitive data storage</li>
                        <li className="mb-2">Secure key management practices</li>
                        <li className="mb-2">Cryptographic verification for data integrity</li>
                        <li className="mb-2">Secure execution environments for sensitive operations</li>
                        <li className="mb-2">Regular security audits and vulnerability assessments</li>
                        <li className="mb-2">Secure infrastructure management</li>
                    </ul>
                    <p className="mb-4">
                        We store your information only for as long as necessary to provide our Service, comply with legal obligations, resolve disputes, and enforce our agreements. Proof data is retained according to the expiration parameters you select during creation.
                    </p>
                    <p className="mb-4">
                        Despite our security measures, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security of your information.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">6. Information Sharing and Disclosure</h2>
                    <p className="mb-4">
                        We may share your information in the following circumstances:
                    </p>

                    <h3 className="text-lg font-medium mt-6 mb-3">6.1 Proof Verification</h3>
                    <p className="mb-4">
                        When you create a proof and share it with a verifier, certain information is disclosed:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">For standard proofs: Your wallet address may be visible to the verifier</li>
                        <li className="mb-2">For privacy-preserving proofs: The verifier can see the proof result with enhanced privacy</li>
                        <li className="mb-2">All verifiers can see the proof parameters (type, amount/threshold, expiration)</li>
                        <li className="mb-2">Blockchain transaction data is publicly visible on the respective networks</li>
                    </ul>

                    <h3 className="text-lg font-medium mt-6 mb-3">6.2 Service Providers</h3>
                    <p className="mb-4">
                        We may employ third-party companies and individuals to facilitate our Service ("Service Providers"), provide the Service on our behalf, perform Service-related services, or assist us in analyzing how our Service is used. These third parties may have access to your information only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                    </p>
                    <p className="mb-4">
                        Examples of Service Providers we use:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Blockchain infrastructure providers</li>
                        <li className="mb-2">Cloud storage providers</li>
                        <li className="mb-2">Analytics services</li>
                        <li className="mb-2">Security monitoring services</li>
                    </ul>

                    <h3 className="text-lg font-medium mt-6 mb-3">6.3 Legal Requirements</h3>
                    <p className="mb-4">
                        We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or a government agency).
                    </p>

                    <h3 className="text-lg font-medium mt-6 mb-3">6.4 Business Transfers</h3>
                    <p className="mb-4">
                        If we are involved in a merger, acquisition, or asset sale, your information may be transferred. We will provide notice before your information is transferred and becomes subject to a different Privacy Policy.
                    </p>

                    <h3 className="text-lg font-medium mt-6 mb-3">6.5 With Your Consent</h3>
                    <p className="mb-4">
                        We may disclose your information for any other purpose with your consent.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">7. Blockchain Data and Public Information</h2>
                    <p className="mb-4">
                        It is important to understand that blockchain networks are public, distributed ledgers. When you use our Service:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Transactions submitted to blockchain networks are publicly visible</li>
                        <li className="mb-2">Standard proofs create verifiable links between your wallet address and the proof</li>
                        <li className="mb-2">Privacy-preserving proofs enhance security but cannot eliminate all potential correlations</li>
                        <li className="mb-2">Blockchain analysis techniques may identify patterns or connections</li>
                        <li className="mb-2">Third parties may associate blockchain transactions with other identifying information outside our control</li>
                    </ul>
                    <p className="mb-4">
                        While we design our Service with privacy in mind, we cannot control the public nature of blockchain data or how third parties may analyze or use this data.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">8. Your Data Rights</h2>
                    <p className="mb-4">
                        Depending on your location, you may have certain rights regarding your information:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">The right to access information we hold about you</li>
                        <li className="mb-2">The right to request correction of inaccurate data</li>
                        <li className="mb-2">The right to request deletion of your data (subject to certain exceptions)</li>
                        <li className="mb-2">The right to restrict or object to processing</li>
                        <li className="mb-2">The right to data portability</li>
                        <li className="mb-2">The right to withdraw consent</li>
                    </ul>
                    <p className="mb-4">
                        Please note that due to the nature of blockchain technology, we may be unable to modify or delete certain information once it has been submitted to a blockchain network.
                    </p>
                    <p className="mb-4">
                        To exercise any of these rights, please contact us using the information provided in the "Contact Us" section. We will respond to your request within the timeframe required by applicable law.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">9. Cookies and Tracking Technologies</h2>
                    <p className="mb-4">
                        Our Service uses cookies and similar tracking technologies to collect and track information about your interactions with our Service. These technologies help us understand user behavior, improve our Service, and remember certain preferences.
                    </p>
                    <p className="mb-4">
                        We use the following types of cookies:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Essential cookies: Required for the operation of our Service</li>
                        <li className="mb-2">Preference cookies: Enable us to remember your preferences and settings</li>
                        <li className="mb-2">Analytics cookies: Help us understand how users interact with our Service</li>
                        <li className="mb-2">Performance cookies: Allow us to monitor and improve the performance of our Service</li>
                    </ul>
                    <p className="mb-4">
                        You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">10. Local Storage</h2>
                    <p className="mb-4">
                        Our Service uses local storage to persist certain information on your device, including:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Wallet connection information</li>
                        <li className="mb-2">User preferences and settings</li>
                        <li className="mb-2">Encrypted data for security operations</li>
                        <li className="mb-2">Proof management information</li>
                    </ul>
                    <p className="mb-4">
                        This information is stored locally on your device and is not transmitted to our servers unless necessary for the operation of our Service. You can clear this information through your browser settings, but doing so may affect your ability to use certain features of our Service.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">11. Children's Privacy</h2>
                    <p className="mb-4">
                        Our Service is not intended for use by children under the age of 18. We do not knowingly collect personally identifiable information from children under 18. If you are a parent or guardian and you are aware that your child has provided us with personal data, please contact us. If we become aware that we have collected personal data from children without verification of parental consent, we take steps to remove that information from our servers.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">12. Changes to This Privacy Policy</h2>
                    <p className="mb-4">
                        We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date at the top of this Privacy Policy.
                    </p>
                    <p className="mb-4">
                        You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">13. Contact Us</h2>
                    <p className="mb-4">
                        If you have any questions about this Privacy Policy, please contact us at:
                    </p>
                    <p className="mb-4">
                        [Contact Email]<br />
                        [Company Address]
                    </p>
                </section>
            </main>

            <Footer />
        </div>
    );
} 