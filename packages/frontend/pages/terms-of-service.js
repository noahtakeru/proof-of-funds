import Head from 'next/head';
import Layout from '../components/Layout';

export default function TermsOfService() {
    return (
        <Layout title="Terms of Service - Arbitr Proof of Funds">
            <div className="mt-8 mb-16">
                <div className="bg-white p-8 rounded-lg shadow-md mb-8">
                    <h1 className="text-3xl font-bold mb-2 text-center text-primary-600">Terms of Service</h1>
                    <div className="w-16 h-1 bg-primary-500 mx-auto my-6 rounded"></div>

                    <p className="mb-8 text-gray-600 text-sm text-center">Last updated: {new Date().toLocaleDateString()}</p>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">1. Acceptance of Terms</h2>
                        <p className="mb-4 text-gray-700">
                            Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Arbitr Proof of Funds platform ("Service") operated by Arbitr ("us", "we", "our").
                        </p>
                        <p className="mb-4 text-gray-700">
                            Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.
                        </p>
                        <p className="mb-4 text-gray-700">
                            By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">2. Wallet Connections</h2>
                        <p className="mb-4 text-gray-700">
                            Our Service requires you to connect one or more blockchain wallets. By connecting your wallet to our Service, you confirm that:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>You are the rightful owner of the wallet and have the authority to use it with our Service</li>
                            <li>You understand the risks associated with connecting your wallet to web services</li>
                            <li>You authorize us to read your wallet balance and transaction information for the purpose of generating proofs</li>
                            <li>You authorize us to initiate transactions that you explicitly approve through your wallet</li>
                            <li>You understand that we never store your private keys or seed phrases</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            You are solely responsible for maintaining the security of your wallet, including but not limited to safeguarding your private keys and seed phrases. We are not responsible for any loss of access to your wallet or any assets contained therein.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">3. Proof of Funds Service</h2>
                        <p className="mb-4 text-gray-700">
                            Our Service provides multiple types of blockchain-based proofs of funds, including standard proofs and privacy-preserving proofs. By using our Service, you understand and agree that:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Standard proofs may reveal your wallet address to verifiers</li>
                            <li>Privacy-preserving proofs utilize advanced cryptography to verify funds with enhanced privacy</li>
                            <li>All proofs are time-bound and expire according to the parameters you set</li>
                            <li>Proof verification relies on blockchain data and cryptographic verification</li>
                            <li>Certain proof operations may incur blockchain transaction fees, which are your responsibility</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            We do not guarantee that proofs will be accepted by any third party or for any specific purpose. The acceptance of proofs is at the sole discretion of verifiers.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">4. System Operations</h2>
                        <p className="mb-4 text-gray-700">
                            For certain privacy-preserving operations, our Service may utilize specialized blockchain technology. By using our privacy features, you understand and agree that:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Our system employs various security and privacy mechanisms</li>
                            <li>These mechanisms may interact with blockchain networks</li>
                            <li>Your personal wallet information is protected by privacy-enhancing technologies</li>
                            <li>Transaction fees may apply for certain operations</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            We take reasonable measures to secure our systems, but we are not responsible for external attacks or vulnerabilities that may affect their operation.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">5. Disclaimer of Warranties</h2>
                        <p className="mb-4 text-gray-700">
                            The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.
                        </p>
                        <p className="mb-4 text-gray-700">
                            Arbitr, its subsidiaries, affiliates, and licensors do not warrant that:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>The Service will function uninterrupted, secure, or available at any particular time or location</li>
                            <li>Any errors or defects will be corrected</li>
                            <li>The Service is free of viruses or other harmful components</li>
                            <li>The results of using the Service will meet your requirements</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            We do not guarantee the accuracy, completeness, or reliability of blockchain data that may be accessed or utilized through our Service. Blockchain networks are subject to congestion, delays, and other operational issues beyond our control.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">6. Limitation of Liability</h2>
                        <p className="mb-4 text-gray-700">
                            In no event shall Arbitr, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Your access to or use of or inability to access or use the Service</li>
                            <li>Any conduct or content of any third party on the Service</li>
                            <li>Any content obtained from the Service</li>
                            <li>Unauthorized access, use, or alteration of your transmissions or content</li>
                            <li>Blockchain network congestion, failures, or changes</li>
                            <li>Wallet connection issues or failures</li>
                            <li>Cryptographic verification failures</li>
                            <li>Smart contract bugs or vulnerabilities</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            Our total liability to you for any claim arising from or relating to these Terms or our Service, regardless of the form of the action, shall be limited to the amount paid, if any, by you to use our Service during the 12 months preceding such claim.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">7. Indemnification</h2>
                        <p className="mb-4 text-gray-700">
                            You agree to defend, indemnify, and hold harmless Arbitr and its licensees, licensors, service providers, and its and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Your violation of these Terms</li>
                            <li>Your use of the Service, including, but not limited to, your User Content, any use of the Service's content, services, and products other than as expressly authorized in these Terms</li>
                            <li>Your use or connection of any cryptocurrency wallets with our Service</li>
                            <li>Your violation of any third-party right, including without limitation any intellectual property right, publicity, confidentiality, property, or privacy right</li>
                            <li>Any misuse of proofs generated through our Service</li>
                            <li>Any transactions initiated through your connected wallets</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">8. Privacy and Security</h2>
                        <p className="mb-4 text-gray-700">
                            Our Service includes privacy-enhancing technology designed to protect your information. However, you acknowledge that:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>No security system can guarantee absolute privacy or security</li>
                            <li>The level of privacy provided depends on the specific service features you select</li>
                            <li>Future advances in technology may potentially affect the privacy of data</li>
                            <li>Blockchain data is generally public and may be subject to analysis</li>
                            <li>We cannot control how verifiers use or share proof verification results</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            We implement reasonable technical measures to protect your privacy, but you should be aware of the inherent limitations of any privacy-enhancing technology.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">9. Service Modifications and Termination</h2>
                        <p className="mb-4 text-gray-700">
                            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                        </p>
                        <p className="mb-4 text-gray-700">
                            We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including, without limitation, if you breach the Terms.
                        </p>
                        <p className="mb-4 text-gray-700">
                            All provisions of the Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">10. Blockchain Risks and Asset Values</h2>
                        <p className="mb-4 text-gray-700">
                            You acknowledge and accept the inherent risks associated with blockchain technology, cryptocurrency, and digital assets, including but not limited to:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Extreme price volatility and potential for complete loss of value</li>
                            <li>Blockchain network congestion and fluctuating transaction fees</li>
                            <li>Potential software bugs, smart contract vulnerabilities, or security breaches</li>
                            <li>Forks and changes to underlying blockchain protocols</li>
                            <li>Regulatory uncertainty and changes in legal status</li>
                            <li>Loss of access due to lost private keys or seed phrases</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            Our Service may display asset values in various denominations, including USD. These valuations are approximations based on third-party data and may not reflect actual market values or trading prices. We make no guarantees regarding the accuracy of asset valuations.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">11. Compliance with Laws</h2>
                        <p className="mb-4 text-gray-700">
                            You agree to comply with all applicable laws, regulations, and rules when using our Service. This includes, but is not limited to, laws related to:
                        </p>
                        <ul className="list-disc pl-8 mb-4 text-gray-700 space-y-2">
                            <li>Financial services and securities</li>
                            <li>Anti-money laundering and countering the financing of terrorism</li>
                            <li>Taxation and reporting of assets</li>
                            <li>Privacy and data protection</li>
                            <li>Consumer protection</li>
                        </ul>
                        <p className="mb-4 text-gray-700">
                            You are solely responsible for determining whether your use of our Service complies with applicable laws and regulations in your jurisdiction. We do not represent that our Service is appropriate or available for use in any particular jurisdiction.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">12. Governing Law</h2>
                        <p className="mb-4 text-gray-700">
                            These Terms shall be governed and construed in accordance with the laws of [Jurisdiction], without regard to its conflict of law provisions.
                        </p>
                        <p className="mb-4 text-gray-700">
                            Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">13. Contact Us</h2>
                        <p className="mb-4 text-gray-700">
                            If you have any questions about these Terms, please contact us at <a href="mailto:support@arbitr.io" className="text-primary-600 hover:underline">support@arbitr.io</a>.
                        </p>
                    </section>
                </div>
            </div>
        </Layout>
    );
} 