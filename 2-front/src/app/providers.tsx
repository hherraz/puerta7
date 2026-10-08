"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { useState, type ReactNode } from "react";

import { wagmiConfig } from "@/lib/wagmi";

/**
 * Providers globales del cliente. RainbowKit va adentro de Wagmi, que a su
 * vez envuelve al QueryClient. El orden importa: el QueryClient se
 * memoiza en el primer render con `useState` para no recrearlo en cada
 * navegación.
 */
interface ProvidersProps {
    readonly children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: "#b45309",
                        accentColorForeground: "#fef3c7",
                        borderRadius: "large",
                    })}
                    modalSize="compact"
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
