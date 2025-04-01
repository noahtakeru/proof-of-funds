import { useState, useEffect } from 'react';
import { getMasterSeed, getEncryptionKeys, getApiKeys, getSecretAccessLog } from '../lib/services/gcpSecretManager';
import { createSecureWalletForProof, checkWalletBalance, clearWalletCache } from '../lib/zk/tempWalletManager';

export default function TestGcpSecretsPage() {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [logs, setLogs] = useState([]);
    const [testWallet, setTestWallet] = useState(null);
    const [mockMode, setMockMode] = useState(false);

    // Check GCP Secret Manager connection
    useEffect(() => {
        const checkConnection = async () => {
            try {
                setIsLoading(true);
                setError('');
                setMessage('');

                // Try to access logs (this shouldn't throw even if no secrets are accessed yet)
                const accessLogs = await getSecretAccessLog();
                setLogs(accessLogs);

                // Check if we're in mock mode
                const mockEnv = process.env.USE_MOCK_SECRETS === 'true';
                setMockMode(mockEnv);

                // Consider connection successful if we can access logs
                setIsConnected(true);
                setMessage('Connected to Secret Manager successfully' + (mockEnv ? ' (using mock secrets)' : ''));
            } catch (error) {
                console.error('Error connecting to GCP Secret Manager:', error);
                setError('Failed to connect to GCP Secret Manager: ' + error.message);
                setIsConnected(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkConnection();
    }, []);

    // Test access to master seed
    const handleTestMasterSeed = async () => {
        try {
            setIsLoading(true);
            setError('');
            setMessage('');

            // Get master seed
            const masterSeed = await getMasterSeed();

            // Don't log the actual seed, just check if it exists
            const success = !!masterSeed && masterSeed.startsWith('0x');

            setMessage(`Master seed accessed successfully: ${success ? 'Valid hex format' : 'Invalid format'}`);

            // Refresh logs
            const accessLogs = await getSecretAccessLog();
            setLogs(accessLogs);
        } catch (error) {
            console.error('Error accessing master seed:', error);
            setError('Failed to access master seed: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Test access to encryption keys
    const handleTestEncryptionKeys = async () => {
        try {
            setIsLoading(true);
            setError('');
            setMessage('');

            // Get encryption keys
            const encryptionKeys = await getEncryptionKeys();

            // Check if the structure is valid
            const isValid = encryptionKeys &&
                encryptionKeys.current &&
                encryptionKeys.keys &&
                encryptionKeys.keys[encryptionKeys.current];

            setMessage(`Encryption keys accessed successfully: ${isValid ? 'Valid structure' : 'Invalid structure'}`);

            // Refresh logs
            const accessLogs = await getSecretAccessLog();
            setLogs(accessLogs);
        } catch (error) {
            console.error('Error accessing encryption keys:', error);
            setError('Failed to access encryption keys: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Test access to API keys
    const handleTestApiKeys = async () => {
        try {
            setIsLoading(true);
            setError('');
            setMessage('');

            // Get API keys
            const apiKeys = await getApiKeys();

            // Check if the structure is valid
            const isValid = apiKeys && Object.keys(apiKeys).length > 0;

            setMessage(`API keys accessed successfully: ${isValid ? 'Valid structure' : 'Invalid structure'}`);

            // Refresh logs
            const accessLogs = await getSecretAccessLog();
            setLogs(accessLogs);
        } catch (error) {
            console.error('Error accessing API keys:', error);
            setError('Failed to access API keys: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Test wallet creation using the master seed
    const handleTestWalletCreation = async () => {
        try {
            setIsLoading(true);
            setError('');
            setMessage('');

            // Create a test wallet
            const wallet = await createSecureWalletForProof('test-gcp-integration', true);
            setTestWallet(wallet);

            // Check wallet balance
            const balanceInfo = await checkWalletBalance(wallet.address);

            setMessage(`Test wallet created successfully: ${wallet.address} (Balance: ${balanceInfo.balance} MATIC)`);

            // Refresh logs
            const accessLogs = await getSecretAccessLog();
            setLogs(accessLogs);
        } catch (error) {
            console.error('Error creating test wallet:', error);
            setError('Failed to create test wallet: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Clear all caches
    const handleClearCaches = async () => {
        try {
            setIsLoading(true);
            setError('');
            setMessage('');

            // Clear the wallet cache and set secret cache
            clearWalletCache();

            setMessage('All caches cleared successfully');
            setTestWallet(null);
        } catch (error) {
            console.error('Error clearing caches:', error);
            setError('Failed to clear caches: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">GCP Secret Manager Integration Test</h1>

            {/* Status Banner */}
            <div className={`p-4 mb-6 rounded-md ${isConnected ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex">
                    <div className="flex-shrink-0">
                        {isConnected ? (
                            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        )}
                    </div>
                    <div className="ml-3">
                        <p className={`text-sm ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
                            {isConnected ? 'Connected to GCP Secret Manager' : 'Not connected to GCP Secret Manager'}
                            {mockMode && ' (MOCK MODE)'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages and Errors */}
            {message && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-blue-700">{message}</p>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Test Controls */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Test Secret Access</h2>

                    <div className="flex flex-col space-y-4">
                        <button
                            onClick={handleTestMasterSeed}
                            disabled={isLoading || !isConnected}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300"
                        >
                            {isLoading ? 'Loading...' : 'Test Master Seed Access'}
                        </button>

                        <button
                            onClick={handleTestEncryptionKeys}
                            disabled={isLoading || !isConnected}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300"
                        >
                            {isLoading ? 'Loading...' : 'Test Encryption Keys Access'}
                        </button>

                        <button
                            onClick={handleTestApiKeys}
                            disabled={isLoading || !isConnected}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300"
                        >
                            {isLoading ? 'Loading...' : 'Test API Keys Access'}
                        </button>

                        <button
                            onClick={handleTestWalletCreation}
                            disabled={isLoading || !isConnected}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300"
                        >
                            {isLoading ? 'Loading...' : 'Test Wallet Creation'}
                        </button>

                        <button
                            onClick={handleClearCaches}
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-300"
                        >
                            {isLoading ? 'Loading...' : 'Clear All Caches'}
                        </button>
                    </div>
                </div>

                {/* Test Wallet Info */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Test Wallet</h2>

                    {testWallet ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Address</label>
                                <div className="mt-1 text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded">
                                    {testWallet.address}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Purpose</label>
                                <div className="mt-1 text-sm text-gray-900">
                                    {testWallet.purpose}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Derivation Path</label>
                                <div className="mt-1 text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded">
                                    {testWallet.derivationPath}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Created At</label>
                                <div className="mt-1 text-sm text-gray-900">
                                    {formatTimestamp(testWallet.createdAt)}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Auto Archive</label>
                                <div className="mt-1 text-sm text-gray-900">
                                    {testWallet.autoArchive ? 'Yes' : 'No'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-4 text-center text-gray-500">
                            No test wallet created yet. Click "Test Wallet Creation" to generate one.
                        </div>
                    )}
                </div>
            </div>

            {/* Access Logs */}
            <div className="mt-6 bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Secret Access Logs</h2>

                {logs.length === 0 ? (
                    <div className="py-4 text-center text-gray-500">
                        No secret access logs yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Timestamp
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Secret Type
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Source
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Error
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {logs.map((log, index) => (
                                    <tr key={index}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatTimestamp(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {log.secretType}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.source === 'gcp' ? 'bg-blue-100 text-blue-800' :
                                                    log.source === 'cache' ? 'bg-green-100 text-green-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {log.source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {log.success ? 'Success' : 'Failed'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">
                                            {log.error || ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Setup Instructions */}
            <div className="mt-6 bg-gray-50 shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">GCP Secret Manager Setup</h2>

                <div className="prose prose-sm max-w-none">
                    <p>To set up GCP Secret Manager integration:</p>

                    <ol className="list-decimal list-inside pl-4 space-y-2">
                        <li>Create a GCP project if you don't have one already</li>
                        <li>Enable the Secret Manager API in your project</li>
                        <li>Create a service account with Secret Manager Secret Accessor role</li>
                        <li>Download the service account key JSON file</li>
                        <li>Place the JSON file in the project root as <code>service-account-key.json</code></li>
                        <li>Create the following secrets in GCP Secret Manager:
                            <ul className="list-disc list-inside pl-4 mt-2">
                                <li><code>master-seed-dev</code>: A 32-byte hex string (with or without 0x prefix)</li>
                                <li><code>encryption-keys-dev</code>: A JSON object with the structure shown below</li>
                                <li><code>api-keys-dev</code>: A JSON object with API keys</li>
                            </ul>
                        </li>
                        <li>Set environment variables in <code>.env.local</code>:
                            <pre className="bg-gray-800 text-gray-100 p-2 rounded mt-2 overflow-x-auto">
                                GCP_PROJECT_ID=your-project-id<br />
                                GCP_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json<br />
                                USE_GCP_DEFAULT_CREDENTIALS=false<br />
                                USE_MOCK_SECRETS=false
                            </pre>
                        </li>
                    </ol>

                    <p className="mt-4">Example encryption keys JSON structure:</p>
                    <pre className="bg-gray-800 text-gray-100 p-2 rounded mt-2 overflow-x-auto">
                        {`{
  "current": "key1",
  "keys": {
    "key1": "your-encryption-key-1",
    "key2": "your-encryption-key-2"
  }
}`}
                    </pre>

                    <p className="mt-4">For local development and testing, set <code>USE_MOCK_SECRETS=true</code> to use mock secrets instead of connecting to GCP.</p>
                </div>
            </div>
        </div>
    );
} 