import Head from 'next/head';
import Footer from '../components/Footer';

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>Terms of Service - Arbitr Proof of Funds</title>
                <meta name="description" content="Terms of Service for Arbitr Proof of Funds platform" />
            </Head>

            <main className="container mx-auto px-4 py-8 max-w-4xl">
                <h1 className="text-3xl font-bold mb-8 text-center">Terms of Service</h1>

                <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
                    <p className="mb-4">
                        Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Arbitr Proof of Funds platform ("Service") operated by Arbitr ("us", "we", "our").
                    </p>
                    <p className="mb-4">
                        Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.
                    </p>
                    <p className="mb-4">
                        By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">2. Wallet Connections</h2>
                    <p className="mb-4">
                        Our Service requires you to connect one or more blockchain wallets. By connecting your wallet to our Service, you confirm that:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">You are the rightful owner of the wallet and have the authority to use it with our Service</li>
                        <li className="mb-2">You understand the risks associated with connecting your wallet to web services</li>
                        <li className="mb-2">You authorize us to read your wallet balance and transaction information for the purpose of generating proofs</li>
                        <li className="mb-2">You authorize us to initiate transactions that you explicitly approve through your wallet</li>
                        <li className="mb-2">You understand that we never store your private keys or seed phrases</li>
                    </ul>
                    <p className="mb-4">
                        You are solely responsible for maintaining the security of your wallet, including but not limited to safeguarding your private keys and seed phrases. We are not responsible for any loss of access to your wallet or any assets contained therein.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">3. Proof of Funds Service</h2>
                    <p className="mb-4">
                        Our Service provides multiple types of blockchain-based proofs of funds, including standard proofs and privacy-preserving proofs. By using our Service, you understand and agree that:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Standard proofs may reveal your wallet address to verifiers</li>
                        <li className="mb-2">Privacy-preserving proofs utilize advanced cryptography to verify funds with enhanced privacy</li>
                        <li className="mb-2">All proofs are time-bound and expire according to the parameters you set</li>
                        <li className="mb-2">Proof verification relies on blockchain data and cryptographic verification</li>
                        <li className="mb-2">Certain proof operations may incur blockchain transaction fees, which are your responsibility</li>
                    </ul>
                    <p className="mb-4">
                        We do not guarantee that proofs will be accepted by any third party or for any specific purpose. The acceptance of proofs is at the sole discretion of verifiers.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">4. System Operations</h2>
                    <p className="mb-4">
                        For certain privacy-preserving operations, our Service may utilize specialized blockchain technology. By using our privacy features, you understand and agree that:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Our system employs various security and privacy mechanisms</li>
                        <li className="mb-2">These mechanisms may interact with blockchain networks</li>
                        <li className="mb-2">Your personal wallet information is protected by privacy-enhancing technologies</li>
                        <li className="mb-2">Transaction fees may apply for certain operations</li>
                    </ul>
                    <p className="mb-4">
                        We take reasonable measures to secure our systems, but we are not responsible for external attacks or vulnerabilities that may affect their operation.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">5. Disclaimer of Warranties</h2>
                    <p className="mb-4">
                        The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.
                    </p>
                    <p className="mb-4">
                        Arbitr, its subsidiaries, affiliates, and licensors do not warrant that:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">The Service will function uninterrupted, secure, or available at any particular time or location</li>
                        <li className="mb-2">Any errors or defects will be corrected</li>
                        <li className="mb-2">The Service is free of viruses or other harmful components</li>
                        <li className="mb-2">The results of using the Service will meet your requirements</li>
                    </ul>
                    <p className="mb-4">
                        We do not guarantee the accuracy, completeness, or reliability of blockchain data that may be accessed or utilized through our Service. Blockchain networks are subject to congestion, delays, and other operational issues beyond our control.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">6. Limitation of Liability</h2>
                    <p className="mb-4">
                        In no event shall Arbitr, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Your access to or use of or inability to access or use the Service</li>
                        <li className="mb-2">Any conduct or content of any third party on the Service</li>
                        <li className="mb-2">Any content obtained from the Service</li>
                        <li className="mb-2">Unauthorized access, use, or alteration of your transmissions or content</li>
                        <li className="mb-2">Blockchain network congestion, failures, or changes</li>
                        <li className="mb-2">Wallet connection issues or failures</li>
                        <li className="mb-2">Cryptographic verification failures</li>
                        <li className="mb-2">Smart contract bugs or vulnerabilities</li>
                    </ul>
                    <p className="mb-4">
                        Our total liability to you for any claim arising from or relating to these Terms or our Service, regardless of the form of the action, shall be limited to the amount paid, if any, by you to use our Service during the 12 months preceding such claim.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">7. Indemnification</h2>
                    <p className="mb-4">
                        You agree to defend, indemnify, and hold harmless Arbitr and its licensees, licensors, service providers, and its and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Your violation of these Terms</li>
                        <li className="mb-2">Your use of the Service, including, but not limited to, your User Content, any use of the Service's content, services, and products other than as expressly authorized in these Terms</li>
                        <li className="mb-2">Your use or connection of any cryptocurrency wallets with our Service</li>
                        <li className="mb-2">Your violation of any third-party right, including without limitation any intellectual property right, publicity, confidentiality, property, or privacy right</li>
                        <li className="mb-2">Any misuse of proofs generated through our Service</li>
                        <li className="mb-2">Any transactions initiated through your connected wallets</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">8. Privacy and Security</h2>
                    <p className="mb-4">
                        Our Service includes privacy-enhancing technology designed to protect your information. However, you acknowledge that:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">No security system can guarantee absolute privacy or security</li>
                        <li className="mb-2">The level of privacy provided depends on the specific service features you select</li>
                        <li className="mb-2">Future advances in technology may potentially affect the privacy of data</li>
                        <li className="mb-2">Blockchain data is generally public and may be subject to analysis</li>
                        <li className="mb-2">We cannot control how verifiers use or share proof verification results</li>
                    </ul>
                    <p className="mb-4">
                        We implement reasonable technical measures to protect your privacy, but you should be aware of the inherent limitations of any privacy-enhancing technology.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">9. Service Modifications and Termination</h2>
                    <p className="mb-4">
                        We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                    </p>
                    <p className="mb-4">
                        We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including, without limitation, if you breach the Terms.
                    </p>
                    <p className="mb-4">
                        All provisions of the Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">10. Blockchain Risks and Asset Values</h2>
                    <p className="mb-4">
                        You acknowledge and accept the inherent risks associated with blockchain technology, cryptocurrency, and digital assets, including but not limited to:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Extreme price volatility and potential for complete loss of value</li>
                        <li className="mb-2">Blockchain network congestion and fluctuating transaction fees</li>
                        <li className="mb-2">Potential software bugs, smart contract vulnerabilities, or security breaches</li>
                        <li className="mb-2">Forks and changes to underlying blockchain protocols</li>
                        <li className="mb-2">Regulatory uncertainty and changes in legal status</li>
                        <li className="mb-2">Loss of access due to lost private keys or seed phrases</li>
                    </ul>
                    <p className="mb-4">
                        Our Service may display asset values in various denominations, including USD. These valuations are approximations based on third-party data and may not reflect actual market values or trading prices. We make no guarantees regarding the accuracy of asset valuations.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">11. Compliance with Laws</h2>
                    <p className="mb-4">
                        You agree to comply with all applicable laws, regulations, and rules when using our Service. This includes, but is not limited to, laws related to:
                    </p>
                    <ul className="list-disc pl-8 mb-4">
                        <li className="mb-2">Financial services and securities</li>
                        <li className="mb-2">Anti-money laundering and countering the financing of terrorism</li>
                        <li className="mb-2">Taxation and reporting of assets</li>
                        <li className="mb-2">Privacy and data protection</li>
                        <li className="mb-2">Consumer protection</li>
                    </ul>
                    <p className="mb-4">
                        You are solely responsible for determining whether your use of our Service complies with applicable laws and regulations in your jurisdiction. We do not represent that our Service is appropriate or available for use in any particular jurisdiction.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">12. Governing Law</h2>
                    <p className="mb-4">
                        These Terms shall be governed and construed in accordance with the laws of [Jurisdiction], without regard to its conflict of law provisions.
                    </p>
                    <p className="mb-4">
                        Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">13. Contact Us</h2>
                    <p className="mb-4">
                        If you have any questions about these Terms, please contact us at [contact email].
                    </p>
                </section>
            </main>

            <Footer />
        </div>
    );
} 