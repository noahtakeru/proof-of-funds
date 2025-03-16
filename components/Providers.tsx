import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig, chains } from '@/config/wagmi';
import type { QueryClient } from '@tanstack/react-query';

interface ProvidersProps {
    children: React.ReactNode;
    queryClient: QueryClient;
}

export default function Providers({ children, queryClient }: ProvidersProps) {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
} 