import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';

export default function ConnectWallet() {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    if (isConnected) {
        return (
            <div className="flex items-center gap-2">
                <span className="hidden md:inline text-sm text-gray-600">
                    {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
                </span>
                <button
                    onClick={() => disconnect()}
                    className="btn btn-secondary text-sm"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => connect({ connector: connectors[0] })}
            className="btn btn-primary"
        >
            Connect Wallet
        </button>
    );
} 