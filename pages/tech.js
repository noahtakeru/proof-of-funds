/**
 * Technology Explanation Page
 * 
 * This page provides in-depth information about the technologies powering the Arbitr platform.
 * It serves as an educational resource for users who want to understand the technical aspects
 * of the proof of funds system.
 * 
 * Key features:
 * - Interactive section navigation
 * - Canvas background animation with particle effects
 * - Detailed explanations of:
 *   - Blockchain technology and its application in Arbitr
 *   - Zero-knowledge proofs and how they enable private verification
 *   - Modern cryptography techniques used for security
 *   - Proof of funds verification methodology
 * 
 * The page uses a tabbed interface to organize complex information in a user-friendly manner,
 * with visual elements to enhance understanding of advanced cryptographic concepts.
 * 
 * The animated canvas background creates a dynamic visual representation of interconnected
 * nodes, symbolizing the decentralized nature of blockchain technology.
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function TechPage() {
    const [activeSection, setActiveSection] = useState('blockchain');
    const canvasRef = useRef(null);

    useEffect(() => {
        // Initialize the canvas animation
        if (canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            let animationFrameId;
            let particles = [];

            const initCanvas = () => {
                if (!canvasRef.current) return; // Safety check
                canvasRef.current.width = canvasRef.current.offsetWidth;
                canvasRef.current.height = canvasRef.current.offsetHeight;
                particles = [];

                // Create particles
                for (let i = 0; i < 50; i++) {
                    particles.push({
                        x: Math.random() * canvasRef.current.width,
                        y: Math.random() * canvasRef.current.height,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: (Math.random() - 0.5) * 0.5,
                        radius: Math.random() * 1.5 + 0.5,
                        color: `rgba(${Math.random() * 50 + 124}, ${Math.random() * 50 + 58}, ${Math.random() * 50 + 237}, 0.5)`
                    });
                }
            };

            const drawParticles = () => {
                if (!canvasRef.current) {
                    // Cancel animation if canvas no longer exists
                    cancelAnimationFrame(animationFrameId);
                    return;
                }

                context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                // Draw and update particles
                particles.forEach(particle => {
                    context.beginPath();
                    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                    context.fillStyle = particle.color;
                    context.fill();

                    // Update position
                    particle.x += particle.vx;
                    particle.y += particle.vy;

                    // Bounce off edges
                    if (particle.x <= 0 || particle.x >= canvasRef.current.width) particle.vx *= -1;
                    if (particle.y <= 0 || particle.y >= canvasRef.current.height) particle.vy *= -1;
                });

                animationFrameId = window.requestAnimationFrame(drawParticles);
            };

            // Handle window resize
            const handleResize = () => {
                initCanvas();
            };

            window.addEventListener('resize', handleResize);
            initCanvas();
            drawParticles();

            return () => {
                window.removeEventListener('resize', handleResize);
                window.cancelAnimationFrame(animationFrameId);
            };
        }
    }, []);

    const techData = {
        blockchain: {
            title: "Blockchain Technology",
            content: (
                <div>
                    <p className="mb-4">
                        Blockchain is a distributed ledger technology that securely records transactions across many computers.
                        This creates a tamper-resistant record of data that is transparent yet secure.
                    </p>
                    <h3 className="text-xl font-semibold mt-4 mb-2">How Blockchain Enables Arbitr</h3>
                    <p className="mb-4">
                        At Arbitr, we leverage blockchain technology to store proof of funds verifications in a way that:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Cannot be altered once submitted</li>
                        <li>Can be verified by anyone with the right credentials</li>
                        <li>Provides a permanent record of verification without storing sensitive data</li>
                        <li>Creates trust through transparent, decentralized consensus</li>
                    </ul>
                    <h3 className="text-xl font-semibold mt-4 mb-2">Polygon Network</h3>
                    <p>
                        We've built Arbitr on the <span className="text-primary-600 font-medium">Polygon network</span>, a Layer 2 scaling solution for Ethereum,
                        providing fast, secure, and cost-effective transactions while maintaining compatibility with Ethereum's ecosystem.
                    </p>
                </div>
            ),
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            )
        },
        zkproofs: {
            title: "Zero-Knowledge Proofs",
            content: (
                <div>
                    <p className="mb-4">
                        Zero-knowledge proofs (ZKPs) are cryptographic methods that allow one party to prove to another that a statement is true,
                        without revealing any additional information beyond the validity of the statement itself.
                    </p>
                    <div className="bg-zk-light p-4 rounded-lg mb-4">
                        <h3 className="text-xl font-semibold mb-2 text-zk">How Zero-Knowledge Works</h3>
                        <p>
                            Imagine proving you know a password without actually revealing the password —
                            that's the essence of zero-knowledge proofs.
                        </p>
                    </div>
                    <h3 className="text-xl font-semibold mt-4 mb-2">At Arbitr, We Use ZK Proofs To:</h3>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Verify that a wallet contains above a certain threshold of funds without revealing the exact amount</li>
                        <li>Confirm ownership of assets without exposing your entire portfolio</li>
                        <li>Generate cryptographic proofs that can be verified by third parties without revealing sensitive data</li>
                        <li>Create specialized proofs (standard, threshold, maximum) tailored to different verification needs</li>
                    </ul>
                </div>
            ),
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            )
        },
        cryptography: {
            title: "Modern Cryptography",
            content: (
                <div>
                    <p className="mb-4">
                        Cryptography is the science of secure communication in the presence of third parties. It's the backbone of digital security
                        and powers everything from encrypted messaging to secure financial transactions.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-primary-50 p-4 rounded-lg">
                            <h3 className="font-semibold mb-2">Public Key Cryptography</h3>
                            <p className="text-sm">
                                The foundation of blockchain transactions, using mathematically related public and private keys to secure transactions.
                            </p>
                        </div>
                        <div className="bg-primary-50 p-4 rounded-lg">
                            <h3 className="font-semibold mb-2">Cryptographic Signatures</h3>
                            <p className="text-sm">
                                Digital signatures that verify the authenticity of a transaction, ensuring it came from the expected source.
                            </p>
                        </div>
                    </div>
                    <h3 className="text-xl font-semibold mt-4 mb-2">Applied Cryptography at Arbitr</h3>
                    <p>
                        We combine multiple cryptographic techniques to create a secure platform:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li>Wallet signatures to verify ownership</li>
                        <li>Zero-knowledge circuits for private verification</li>
                        <li>Secure multi-chain asset validation</li>
                        <li>Time-bound proofs with cryptographic expiration</li>
                    </ul>
                </div>
            ),
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            )
        },
        proofoffunds: {
            title: "Proof of Funds Technology",
            content: (
                <div>
                    <p className="mb-4">
                        Proof of Funds (PoF) in the blockchain context is a verifiable confirmation that an entity possesses a specified amount of assets
                        at a particular time. Traditional PoF mechanisms often expose private information, but blockchain enables a new approach.
                    </p>
                    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
                        <h3 className="text-xl font-semibold mb-3">The Arbitr Approach</h3>
                        <p className="mb-3">
                            Arbitr's technology integrates all the components we've discussed into a seamless, user-friendly solution:
                        </p>
                        <div className="relative">
                            <div className="border-l-2 border-primary-600 pl-4 py-1 mb-3">
                                <span className="text-primary-600 font-medium">Blockchain</span>: Provides the immutable, transparent ledger for verification
                            </div>
                            <div className="border-l-2 border-primary-600 pl-4 py-1 mb-3">
                                <span className="text-primary-600 font-medium">Zero-Knowledge Proofs</span>: Enable private verification without data exposure
                            </div>
                            <div className="border-l-2 border-primary-600 pl-4 py-1 mb-3">
                                <span className="text-primary-600 font-medium">Cryptography</span>: Secures the entire process through signatures and encryption
                            </div>
                            <div className="border-l-2 border-primary-600 pl-4 py-1">
                                <span className="text-zk-accent font-medium">Arbitr PoF</span>: Combines these technologies into a practical solution
                            </div>
                        </div>
                    </div>
                    <div className="bg-zk-light p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">Types of Proof Verification in Arbitr</h3>
                        <ul className="space-y-2">
                            <li className="flex items-start">
                                <div className="h-6 w-6 rounded-full bg-primary-600 text-white flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">1</div>
                                <div>
                                    <span className="font-medium">Standard Proof</span>: Verifies a specific amount of funds
                                </div>
                            </li>
                            <li className="flex items-start">
                                <div className="h-6 w-6 rounded-full bg-primary-600 text-white flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">2</div>
                                <div>
                                    <span className="font-medium">Threshold Proof</span>: Confirms the user has at least a certain amount
                                </div>
                            </li>
                            <li className="flex items-start">
                                <div className="h-6 w-6 rounded-full bg-primary-600 text-white flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">3</div>
                                <div>
                                    <span className="font-medium">Maximum Proof</span>: Verifies the user has no more than a specific amount
                                </div>
                            </li>
                            <li className="flex items-start">
                                <div className="h-6 w-6 rounded-full bg-zk-accent text-white flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">ZK</div>
                                <div>
                                    <span className="font-medium">Zero-Knowledge Variants</span>: Private versions of all the above proof types
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            ),
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            )
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">The Technology Behind <span className="text-primary-600">Arbitr<span className="text-zk-accent">.</span></span></h1>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                    Explore the cutting-edge technology that powers our secure and private proof of funds platform.
                </p>
            </div>

            <div className="relative mb-12">
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full -z-10"></canvas>
                <div className="bg-white bg-opacity-80 rounded-xl shadow-lg p-4 relative z-10">
                    <div className="mb-4">
                        <h2 className="text-2xl font-semibold">Interactive Tech Explorer</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {Object.entries(techData).map(([key, value]) => (
                            <div
                                key={key}
                                className={`cursor-pointer p-4 rounded-lg transition-all duration-300 ${activeSection === key
                                    ? key === 'zkproofs'
                                        ? 'bg-zk-light border-zk-accent border-2'
                                        : 'bg-primary-100 border-primary-600 border-2'
                                    : 'bg-white border border-gray-200 hover:border-primary-300'
                                    }`}
                                onClick={() => setActiveSection(key)}
                            >
                                <div className="flex items-center">
                                    <div className={`mr-3 ${activeSection === key ? key === 'zkproofs' ? 'text-zk-accent' : 'text-primary-600' : 'text-gray-500'}`}>
                                        {value.icon}
                                    </div>
                                    <h3 className={`font-medium ${activeSection === key ? key === 'zkproofs' ? 'text-zk' : 'text-primary-700' : 'text-gray-700'}`}>
                                        {value.title}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow border">
                        {techData[activeSection].content}
                    </div>
                </div>
            </div>

            <div className="bg-primary-50 rounded-lg p-8 shadow-md">
                <h2 className="text-2xl font-semibold mb-6">Why Our Technology Matters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Privacy in a Transparent World</h3>
                        <p className="text-gray-600">
                            In an increasingly transparent blockchain ecosystem, privacy becomes a luxury. Our zero-knowledge proofs
                            protect your financial information while still providing necessary verification.
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Trust Without Vulnerability</h3>
                        <p className="text-gray-600">
                            Traditional verification methods force you to reveal sensitive financial data. Arbitr creates trust through
                            cryptographic proof, not personal exposure.
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Bridging Traditional & Crypto Finance</h3>
                        <p className="text-gray-600">
                            Our technology bridges the gap between traditional finance verification requirements and the privacy ethos
                            of the crypto world, making proof of funds accessible for everyone.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-12 text-center">
                <h2 className="text-2xl font-semibold mb-6">Ready to Experience Secure Verification?</h2>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link href="/create" className="px-8 py-4 text-lg font-bold rounded-lg shadow-lg bg-primary-600 hover:bg-primary-700 text-white transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Proof
                    </Link>
                    <Link href="/verify" className="px-8 py-4 text-lg font-bold rounded-lg shadow-lg bg-zk-accent hover:bg-zk-accent-dark text-white transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Verify Proof
                    </Link>
                </div>
            </div>
        </div>
    );
} 