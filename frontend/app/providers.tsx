"use client";

import { ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";

type Props = {
  children: ReactNode;
};

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "1a0af1fa2f0e4ba2a9f23b9364884356";

const wagmiConfig = getDefaultConfig({
  appName: "CipherGate Labs",
  projectId,
  chains: [hardhat, sepolia],
  ssr: true,
});

export function Providers({ children }: Props) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={hardhat}
          theme={lightTheme({
            accentColor: "#5de0e6",
            borderRadius: "large",
          })}
        >
          <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
