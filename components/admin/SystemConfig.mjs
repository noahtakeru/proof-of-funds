/**
 * System Configuration Component
 * 
 * Administrative interface for managing global system settings and platform features
 * within the Arbitr platform. Allows administrators to configure options that affect
 * the entire application's behavior.
 * 
 * Key features:
 * - Feature Toggles: Enable/disable specific platform functionalities
 *   - Different proof types (standard, threshold, maximum, zero-knowledge)
 *   - Maintenance mode for system-wide updates
 *   - Security settings like strict verification
 * 
 * - Network Configuration: Manage blockchain networks for the application
 *   - Chain ID configuration
 *   - RPC endpoints for blockchain interaction
 *   - Block explorer URLs for transaction links
 *   - Network activation/deactivation
 * 
 * - UI Customization: Configure user-facing text and notifications
 *   - Help text for various platform features
 *   - System notification messages
 * 
 * Note: Currently using local state for demonstration.
 * Production implementation would integrate with backend configuration
 * services and blockchain network management systems.
 */

import { useState } from 'react';

export default function SystemConfig() {
    // Feature Toggles
    const [toggles, setToggles] = useState({
        standardProofs: true,
        thresholdProofs: true,
        maximumProofs: true,
        zkProofs: false,
        maintenanceMode: false,
        strictVerification: true
    });

    // Network Configurations
    const [networks, setNetworks] = useState([
        {
            id: '1',
            name: 'Polygon Amoy',
            chainId: 80002,
            rpcUrl: 'https://rpc-amoy.polygon.technology/',
            blockExplorer: 'https://amoy.polygonscan.com/',
            isActive: true
        },
        {
            id: '2',
            name: 'Polygon Mumbai',
            chainId: 80001,
            rpcUrl: 'https://rpc-mumbai.maticvigil.com/',
            blockExplorer: 'https://mumbai.polygonscan.com/',
            isActive: false
        }
    ]);

    // UI Configuration
    const [uiConfig, setUiConfig] = useState({
        helpText: {
            createProof: 'Generate cryptographic proof of your funds without revealing your exact balance.',
            verifyProof: 'Verify a proof someone has shared with you to confirm their financial capacity.',
            connectWallet: 'Connect your wallet to interact with the platform.'
        },
        notifications: {
            welcome: 'Welcome to Proof of Funds! Connect your wallet to get started.',
            proofCreated: 'Your proof has been created successfully!',
            proofVerified: 'Proof verified successfully!'
        }
    });

    // Update toggles
    const handleToggleChange = (key) => {
        setToggles({
            ...toggles,
            [key]: !toggles[key]
        });
    };

    // Update network status
    const handleNetworkStatusChange = (networkId, isActive) => {
        setNetworks(networks.map(network =>
            network.id === networkId ? { ...network, isActive } : network
        ));
    };

    // Update network details
    const handleNetworkUpdate = (networkId, field, value) => {
        setNetworks(networks.map(network =>
            network.id === networkId ? { ...network, [field]: value } : network
        ));
    };

    // Update UI configuration
    const handleUiConfigUpdate = (section, key, value) => {
        setUiConfig({
            ...uiConfig,
            [section]: {
                ...uiConfig[section],
                [key]: value
            }
        });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-8">
            <h2 className="text-xl font-semibold mb-4">System Configuration</h2>

            {/* Feature Toggles */}
            <div>
                <h3 className="text-lg font-medium mb-4">Feature Toggles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(toggles).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-3 border rounded">
                            <div>
                                <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                                <p className="text-sm text-gray-600">
                                    {key === 'maintenanceMode' ? 'Put the platform in maintenance mode' :
                                        key === 'strictVerification' ? 'Enforce stricter verification requirements' :
                                            `Enable ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} feature`}
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={value}
                                    onChange={() => handleToggleChange(key)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Network Configuration */}
            <div>
                <h3 className="text-lg font-medium mb-4">Network Configuration</h3>
                {networks.map(network => (
                    <div key={network.id} className="border rounded p-4 mb-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-medium">{network.name}</h4>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={network.isActive}
                                    onChange={() => handleNetworkStatusChange(network.id, !network.isActive)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Chain ID</label>
                                <input
                                    type="number"
                                    className="w-full border rounded p-2"
                                    value={network.chainId}
                                    onChange={e => handleNetworkUpdate(network.id, 'chainId', parseInt(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">RPC URL</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2"
                                    value={network.rpcUrl}
                                    onChange={e => handleNetworkUpdate(network.id, 'rpcUrl', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Block Explorer</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2"
                                    value={network.blockExplorer}
                                    onChange={e => handleNetworkUpdate(network.id, 'blockExplorer', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* UI Customization */}
            <div>
                <h3 className="text-lg font-medium mb-4">UI Customization</h3>

                <div className="mb-6">
                    <h4 className="font-medium mb-2">Help Text</h4>
                    {Object.entries(uiConfig.helpText).map(([key, value]) => (
                        <div key={key} className="mb-3">
                            <label className="block text-sm text-gray-600 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                            <input
                                type="text"
                                className="w-full border rounded p-2"
                                value={value}
                                onChange={e => handleUiConfigUpdate('helpText', key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>

                <div>
                    <h4 className="font-medium mb-2">Notification Messages</h4>
                    {Object.entries(uiConfig.notifications).map(([key, value]) => (
                        <div key={key} className="mb-3">
                            <label className="block text-sm text-gray-600 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                            <input
                                type="text"
                                className="w-full border rounded p-2"
                                value={value}
                                onChange={e => handleUiConfigUpdate('notifications', key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                    onClick={() => alert('Settings would be saved to the database in production')}
                >
                    Save All Settings
                </button>
            </div>
        </div>
    );
} 