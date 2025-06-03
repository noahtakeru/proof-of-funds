// Home Page / Landing Page Component
// 
// This is the main landing page for the Arbitr (Proof of Funds) application.
// It provides an overview of the platform's features and capabilities,
// with interactive elements to engage users and explain the concept.

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

/**
 * LockIcon Component
 * A simple SVG icon representing security/locking
 * Used in various places to emphasize the security aspects of the platform
 */
const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
);

export default function Home() {
    // State to track the current slide in the carousel
    const [currentSlide, setCurrentSlide] = useState(0);

    // Reference to the carousel DOM element for animation
    const carouselRef = useRef(null);

    // Total number of slides in the carousel
    const slidesCount = 3;

    /**
     * Carousel Autoplay Effect
     * Automatically advances the carousel to the next slide every 5 seconds
     */
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slidesCount);
        }, 5000);

        // Clean up the interval when component unmounts
        return () => clearInterval(interval);
    }, []);

    /**
     * Carousel Animation Effect
     * Updates the carousel's transform property when the slide changes
     * Creates a smooth sliding animation
     */
    useEffect(() => {
        if (carouselRef.current) {
            carouselRef.current.style.transform = `translateX(-${currentSlide * 100}%)`;
        }
    }, [currentSlide]);

    /**
     * Testimonial Data
     * Collection of user testimonials to display on the page
     * Includes quote, author name, and author title for each testimonial
     */
    const testimonials = [
        {
            quote: 'Arbitr has completely transformed how we verify clients\' financial capacity. Fast, secure, and private.',
            author: 'Emma Chen',
            title: 'Finance Director, BlockTech Ventures'
        },
        {
            quote: 'The zero-knowledge proof system is revolutionary. Our clients love the privacy it provides.',
            author: 'James Wilson',
            title: 'Crypto Investment Advisor'
        },
        {
            quote: 'Setting up Proof of Funds used to take days. With Arbitr, it takes minutes.',
            author: 'Sarah Johnson',
            title: 'DeFi Platform Founder'
        }
    ];

    /**
     * FloatingElement Component
     * Creates decorative floating elements in the background
     * Adds visual interest and a modern feel to the landing page
     * 
     * @param {number} delay - Animation delay in seconds
     * @param {number} duration - Animation duration in seconds
     * @param {number} size - Element size in pixels
     * @param {number} left - Horizontal position as percentage
     * @param {number} top - Vertical position as percentage
     * @param {number} opacity - Element opacity (0-1)
     */
    const FloatingElement = ({ delay, duration, size, left, top, opacity }) => {
        return (
            <div
                className="absolute rounded-lg bg-primary-300 opacity-30"
                style={{
                    width: size,
                    height: size,
                    left: `${left}%`,
                    top: `${top}%`,
                    opacity: opacity,
                    animation: `float ${duration}s ease-in-out infinite ${delay}s`,
                }}
            ></div>
        );
    };

    return (
        <div className="text-center">
            {/* Hero Section with Animation */}
            <section className="pt-12 pb-24 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary-600 opacity-5 z-0"></div>

                <div className="max-w-4xl mx-auto relative z-10">
                    <h1 className="text-5xl md:text-6xl font-bold mb-4">
                        <span className="text-primary-600">Arbitr<span className="text-zk-accent">.</span></span>
                    </h1>
                    <p className="text-xl text-gray-600 mb-6">
                        Securely verify blockchain assets with privacy-preserving proofs
                    </p>

                    <div className="max-w-3xl mx-auto mb-10">
                        <p className="text-lg text-gray-700 mb-6">
                            Proof of Funds is a verification method that confirms a person or entity possesses
                            sufficient financial resources for a transaction without revealing sensitive details.
                        </p>
                        <p className="text-lg text-gray-700 mb-6">
                            In a digital economy where trust is paramount but privacy is essential,
                            Arbitr bridges this gap with cutting-edge blockchain technology.
                        </p>
                    </div>

                    {/* Call-to-Action Buttons */}
                    <div className="flex justify-center items-center gap-8 my-12">
                        <Link href="/create" className="px-8 py-4 text-lg font-bold rounded-lg shadow-lg bg-primary-600 hover:bg-primary-700 text-white transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Proof
                        </Link>
                        <Link href="/verify" className="px-8 py-4 text-lg font-bold rounded-lg shadow-lg bg-zk-accent hover:bg-zk-accent-dark text-white transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Verify Proof
                        </Link>
                    </div>

                    {/* Value Proposition Cards */}
                    <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                        <h2 className="text-2xl font-bold mb-6">Why Proof of Funds Matters</h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                            {/* Business Use Case Card */}
                            <div className="bg-primary-50 p-6 rounded-lg">
                                <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">For Businesses</h3>
                                <p className="text-gray-700">
                                    Verify clients' financial capacity instantly without lengthy bank processes.
                                    Confidently proceed with high-value transactions.
                                </p>
                            </div>

                            {/* Individual Use Case Card */}
                            <div className="bg-primary-50 p-6 rounded-lg">
                                <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">For Individuals</h3>
                                <p className="text-gray-700">
                                    Prove your financial standing without exposing account details.
                                    Protect your privacy while satisfying verification requirements.
                                </p>
                            </div>

                            {/* Zero-Knowledge Feature Card */}
                            <div className="bg-zk-light p-6 rounded-lg">
                                <div className="h-12 w-12 bg-white text-zk-accent-dark rounded-full flex items-center justify-center mb-4">
                                    <span className="font-bold">ZK</span>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Zero-Knowledge</h3>
                                <p className="text-gray-700">
                                    Our advanced cryptographic proofs verify information without revealing the underlying data.
                                    Maximum security, absolute privacy.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section - Interactive Carousel */}
            <section className="py-12 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                            How It Works
                        </h2>
                        <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
                            Arbitr Proof of Funds makes it easy to verify assets without compromising privacy.
                        </p>
                    </div>

                    {/* Step-by-Step Carousel */}
                    <div className="carousel overflow-hidden mb-8">
                        <div
                            ref={carouselRef}
                            className="carousel-inner flex transition-transform duration-500 ease-in-out"
                        >
                            {/* Step 1: Connect Wallet */}
                            <div className="carousel-item w-full flex-shrink-0 px-4">
                                <div className="bg-white rounded-xl shadow-md p-8">
                                    <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-2xl font-bold mb-6 mx-auto">1</div>
                                    <h3 className="text-xl font-bold mb-4">Connect Your Wallet</h3>
                                    <p className="text-gray-600 mb-6">
                                        Connect your blockchain wallet containing the assets you want to prove.
                                        We support multiple chains including Ethereum, Polygon, and Solana.
                                    </p>
                                    <div className="flex justify-center space-x-3">
                                        <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600">
                                                <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"></path>
                                            </svg>
                                        </div>
                                        <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600">
                                                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                                                <path d="M12 12h.01"></path>
                                            </svg>
                                        </div>
                                        <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600">
                                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Generate Proof */}
                            <div className="carousel-item w-full flex-shrink-0 px-4">
                                <div className="bg-white rounded-xl shadow-md p-8">
                                    <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-2xl font-bold mb-6 mx-auto">2</div>
                                    <h3 className="text-xl font-bold mb-4">Generate Zero-Knowledge Proof</h3>
                                    <p className="text-gray-600 mb-6">
                                        Create a cryptographic proof that verifies your financial position without
                                        revealing exact balances or sensitive information.
                                    </p>
                                    <div className="flex justify-center">
                                        <div className="w-16 h-16 bg-zk-light rounded-full flex items-center justify-center">
                                            <span className="text-zk font-bold">ZK</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Share Proof */}
                            <div className="carousel-item w-full flex-shrink-0 px-4">
                                <div className="bg-white rounded-xl shadow-md p-8">
                                    <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-2xl font-bold mb-6 mx-auto">3</div>
                                    <h3 className="text-xl font-bold mb-4">Share Your Proof</h3>
                                    <p className="text-gray-600 mb-6">
                                        Share your proof with third parties who can verify it without accessing
                                        your private financial details. Perfect for deals and applications.
                                    </p>
                                    <div className="flex justify-center space-x-3 items-center">
                                        <div className="w-12 h-12 bg-primary-50 rounded-md flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary-600">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                                            </svg>
                                        </div>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary-600">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                        </svg>
                                        <div className="w-12 h-12 bg-primary-50 rounded-md flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary-600">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Carousel Navigation Dots */}
                    <div className="flex justify-center space-x-2">
                        {[...Array(slidesCount)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentSlide(i)}
                                className={`w-3 h-3 rounded-full transition-colors ${i === currentSlide ? 'bg-primary-600' : 'bg-gray-300'}`}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <h2 className="text-3xl font-bold mb-12">Why Choose Arbitr</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="feature-card bg-white p-6 shadow-md rounded-xl">
                            <div className="h-14 w-14 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Complete Privacy</h3>
                            <p className="text-gray-600">
                                Prove your financial position without revealing exact balances or exposing sensitive information.
                            </p>
                        </div>

                        <div className="feature-card bg-white p-6 shadow-md rounded-xl">
                            <div className="h-14 w-14 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Multiple Proof Types</h3>
                            <p className="text-gray-600">
                                Generate standard, threshold, or maximum proofs depending on your specific verification needs.
                            </p>
                        </div>

                        <div className="feature-card bg-white p-6 shadow-md rounded-xl">
                            <div className="h-14 w-14 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Multi-Chain Support</h3>
                            <p className="text-gray-600">
                                Connect wallets from different blockchains and aggregate your assets for comprehensive verification.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-16 bg-primary-50">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-3xl font-bold mb-12">What Our Users Say</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {testimonials.map((item, index) => (
                            <div key={index} className="bg-white p-6 rounded-xl shadow-md">
                                <div className="text-primary-400 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="w-8 h-8" viewBox="0 0 16 16">
                                        <path d="M12 12a1 1 0 0 0 1-1V8.558a1 1 0 0 0-1-1h-1.388c0-.351.021-.703.062-1.054.062-.372.166-.703.31-.992.145-.29.331-.517.559-.683.227-.186.516-.279.868-.279V3c-.579 0-1.085.124-1.52.372a3.322 3.322 0 0 0-1.085.992 4.92 4.92 0 0 0-.62 1.458A7.712 7.712 0 0 0 9 7.558V11a1 1 0 0 0 1 1h2Zm-6 0a1 1 0 0 0 1-1V8.558a1 1 0 0 0-1-1H4.612c0-.351.021-.703.062-1.054.062-.372.166-.703.31-.992.145-.29.331-.517.559-.683.227-.186.516-.279.868-.279V3c-.579 0-1.085.124-1.52.372a3.322 3.322 0 0 0-1.085.992 4.92 4.92 0 0 0-.62 1.458A7.712 7.712 0 0 0 3 7.558V11a1 1 0 0 0 1 1h2Z" />
                                    </svg>
                                </div>
                                <p className="text-gray-700 mb-4">{item.quote}</p>
                                <div className="mt-6">
                                    <p className="font-semibold">{item.author}</p>
                                    <p className="text-sm text-gray-500">{item.title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-10 text-white text-center">
                        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
                        <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                            Create your first proof of funds on Arbitr in minutes.
                            No coding required.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/create" className="btn bg-white text-primary-700 hover:bg-gray-100 px-8 py-3">
                                Create Your First Proof
                            </Link>
                            <Link href="/about" className="btn text-white border border-white hover:bg-primary-500 px-8 py-3">
                                Learn More
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
} 