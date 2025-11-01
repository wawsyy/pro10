"use client";

import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { BrowserProvider, JsonRpcSigner } from "ethers";

function walletClientToSigner(walletClient: any): Promise<JsonRpcSigner> {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain?.id,
    name: chain?.name ?? "unknown",
    ensAddress: chain?.contracts?.ensRegistry?.address,
  };

  const provider = new BrowserProvider(transport, network);
  return provider.getSigner(account.address);
}

export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient]
  );
}

