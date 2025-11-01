"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { ethers } from "ethers";

import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { EncryptedAgeGateABI } from "@/abi/EncryptedAgeGateABI";
import { EncryptedAgeGateAddresses } from "@/abi/EncryptedAgeGateAddresses";

type AgeGateContractInfo = {
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
  abi: typeof EncryptedAgeGateABI.abi;
};

const INITIAL_MOCK_CHAINS: Record<number, string> = {
  31337: "http://127.0.0.1:8545",
};

function getContractInfo(chainId: number | undefined): AgeGateContractInfo {
  if (!chainId) {
    return { abi: EncryptedAgeGateABI.abi };
  }

  const entry =
    EncryptedAgeGateAddresses[
      chainId.toString() as keyof typeof EncryptedAgeGateAddresses
    ];

  if (!entry || entry.address === ethers.ZeroAddress) {
    return { abi: EncryptedAgeGateABI.abi, chainId };
  }

  return {
    abi: EncryptedAgeGateABI.abi,
    address: entry.address as `0x${string}`,
    chainId: entry.chainId,
    chainName: entry.chainName,
  };
}

type Handles = {
  age?: string;
  decision?: string;
  adults?: string;
  minors?: string;
};

type ClearValues = {
  decision?: "Adult" | "Minor";
  adults?: number;
  minors?: number;
};

export function AgeVerificationExperience() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient({ chainId });
  const publicClient = usePublicClient({ chainId });
  const signerPromise = useEthersSigner({ chainId });
  const { storage } = useInMemoryStorage();

  const [ageInput, setAgeInput] = useState("21");
  const [handles, setHandles] = useState<Handles>({});
  const [clearValues, setClearValues] = useState<ClearValues>({});
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptingStat, setDecryptingStat] = useState<"adults" | "minors" | null>(null);
  const [shareAddress, setShareAddress] = useState("");
  const [sharing, setSharing] = useState(false);

  const contract = useMemo(() => getContractInfo(chainId), [chainId]);

  const {
    instance,
    status: fheStatus,
    error: fheError,
  } = useFhevm({
    provider: walletClient as unknown as ethers.Eip1193Provider | undefined,
    chainId,
    initialMockChains: INITIAL_MOCK_CHAINS,
    enabled: Boolean(walletClient),
  });

  const canUseContract = Boolean(contract.address);

  const refreshHandles = useCallback(async () => {
    if (!publicClient || !contract.address || !address) {
      setHandles({});
      return;
    }

    setRefreshing(true);
    try {
      const [age, decision, adultCount, minorCount] = await Promise.all([
        publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "getLatestAge",
          args: [address],
        }),
        publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "getLatestDecision",
          args: [address],
        }),
        publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "getAdultSubmissions",
        }),
        publicClient.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: "getMinorSubmissions",
        }),
      ]);

      setHandles({
        age: age as string,
        decision: decision as string,
        adults: adultCount as string,
        minors: minorCount as string,
      });
    } catch (err) {
      console.error(err);
      setMessage("Unable to refresh encrypted state. Check your RPC connection.");
    } finally {
      setRefreshing(false);
    }
  }, [publicClient, contract.address, contract.abi, address]);

  useEffect(() => {
    if (isConnected && canUseContract) {
      refreshHandles();
    } else {
      setHandles({});
      setClearValues({});
    }
  }, [isConnected, canUseContract, refreshHandles]);

  const submitAge = useCallback(async () => {
    if (!instance || !address || !contract.address || !walletClient) {
      setMessage("Connect your wallet on a supported chain to submit.");
      return;
    }

    if (fheStatus !== "ready") {
      setMessage(`FHEVM not ready (status: ${fheStatus}). Please wait...`);
      if (fheError) {
        setMessage(`FHEVM error: ${fheError.message}. On Sepolia, this may indicate Relayer SDK issues.`);
      }
      return;
    }

    const numericAge = Number(ageInput);
    if (Number.isNaN(numericAge) || numericAge < 0 || numericAge > 120) {
      setMessage("Provide a valid age between 0 and 120.");
      return;
    }

    setSubmitting(true);
    setMessage("Encrypting age...");
    try {
      const input = instance.createEncryptedInput(contract.address, address);
      input.add8(numericAge);
      const encrypted = await input.encrypt();
      const encryptedHandle = ethers.hexlify(encrypted.handles[0]) as `0x${string}`;
      const proofHex = ethers.hexlify(encrypted.inputProof) as `0x${string}`;

      setMessage("Please confirm the transaction in MetaMask...");
      const hash = await walletClient.writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "submitAge",
        args: [encryptedHandle, proofHex],
        account: address,
        chain: walletClient.chain,
      });

      setMessage(`Transaction submitted: ${hash}. Waiting for confirmation...`);
      
      // Wait for transaction receipt
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          setMessage("Transaction confirmed! Refreshing encrypted state...");
          // Wait a bit for state to propagate
          await new Promise((resolve) => setTimeout(resolve, 3000));
          
          // Refresh handles multiple times to ensure state is updated
          let retries = 3;
          while (retries > 0) {
            await refreshHandles();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            
            // Check if decision handle is now non-zero
            const currentDecision = await publicClient.readContract({
              address: contract.address,
              abi: contract.abi,
              functionName: "getLatestDecision",
              args: [address],
            });
            
            if (currentDecision && currentDecision !== ethers.ZeroHash && currentDecision !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
              setMessage("Submission confirmed. You can now decrypt.");
              break;
            }
            
            retries--;
            if (retries === 0) {
              setMessage("Transaction confirmed but state not updated yet. Please refresh the page or try again.");
            }
          }
        } else {
          setMessage("Transaction failed. Please check the transaction on block explorer and try again.");
        }
      } else {
        // Fallback if publicClient not available
        await refreshHandles();
        setMessage("Submission confirmed. You can now decrypt.");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.cause?.code === 4001 || err?.code === "ACTION_REJECTED" || err?.message?.includes("rejected") || err?.message?.includes("denied")) {
        setMessage("Transaction was rejected. Please click 'Encrypt & Submit' again and approve the transaction in MetaMask.");
      } else if (err?.message?.includes("revert") || err?.message?.includes("execution reverted")) {
        setMessage(`Contract execution failed: ${err?.shortMessage || err?.message}. On Sepolia, ensure FHEVM Relayer is properly configured.`);
      } else {
        setMessage(`Submission failed: ${err?.shortMessage || err?.message || "Unknown error"}. Check console for details.`);
        if (chainId === 11155111) {
          setMessage(`Sepolia submission failed. Ensure Relayer SDK is configured correctly and your wallet has Sepolia ETH.`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [instance, address, contract.address, contract.abi, walletClient, ageInput, refreshHandles, publicClient, fheStatus, fheError, chainId]);

  const decryptDecision = useCallback(async () => {
    if (!instance || !handles.decision || !contract.address || !signerPromise) {
      setMessage("Missing decision handle. Submit an age first.");
      return;
    }

    // Check if handle is ZeroHash (no submission yet)
    if (handles.decision === ethers.ZeroHash || handles.decision === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      setMessage("No age submitted yet. Please submit your age first using 'Encrypt & Submit'.");
      return;
    }

    setDecrypting(true);
    setMessage("Requesting FHEVM signature...");
    try {
      const signer = await signerPromise;
      if (!signer) {
        setMessage("Signer unavailable.");
        return;
      }

      const sig = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [contract.address],
        signer,
        storage
      );

      if (!sig) {
        setMessage("Unable to obtain FHEVM signature.");
        return;
      }

      const result = await instance.userDecrypt(
        [{ handle: handles.decision, contractAddress: contract.address }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );

      const raw = result[handles.decision];
      const isAdult = raw && BigInt(raw) === BigInt(1);
      setClearValues((prev) => ({ ...prev, decision: isAdult ? "Adult" : "Minor" }));
      setMessage("Decision decrypted locally.");
    } catch (err) {
      console.error(err);
      setMessage("Decryption failed.");
    } finally {
      setDecrypting(false);
    }
  }, [instance, handles.decision, contract.address, signerPromise, storage]);

  const decryptStat = useCallback(
    async (kind: "adults" | "minors") => {
      const handle = handles[kind];
      if (!instance || !handle || !contract.address || !signerPromise) {
        setMessage("Missing encrypted statistic.");
        return;
      }

      setDecryptingStat(kind);
      setMessage("Decrypting encrypted statistics...");
      try {
        const signer = await signerPromise;
        if (!signer) {
          setMessage("Signer unavailable.");
          return;
        }

        const sig = await FhevmDecryptionSignature.loadOrSign(
          instance,
          [contract.address],
          signer,
          storage
        );

        if (!sig) {
          setMessage("Unable to obtain FHEVM signature.");
          return;
        }

        const result = await instance.userDecrypt(
          [{ handle, contractAddress: contract.address }],
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        const value = result[handle] ? Number(result[handle]) : 0;
        setClearValues((prev) => ({ ...prev, [kind]: value }));
        setMessage("Statistic decrypted locally.");
      } catch (err) {
        console.error(err);
        setMessage("Unable to decrypt statistic.");
      } finally {
        setDecryptingStat(null);
      }
    },
    [instance, handles, contract.address, signerPromise, storage]
  );

  const shareStats = useCallback(async () => {
    if (!walletClient || !address || !contract.address) {
      setMessage("Connect your wallet before sharing stats.");
      return;
    }

    if (!ethers.isAddress(shareAddress)) {
      setMessage("Enter a valid EOA to grant stats access.");
      return;
    }

    const viewer = shareAddress as `0x${string}`;

    setSharing(true);
    setMessage("Please confirm the transaction in MetaMask...");
    try {
      await walletClient.writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "allowStats",
        args: [viewer],
        account: address,
        chain: walletClient.chain,
      });
      setMessage(`Stats can now be decrypted by ${shareAddress}.`);
    } catch (err: any) {
      console.error(err);
      if (err?.cause?.code === 4001 || err?.code === "ACTION_REJECTED" || err?.message?.includes("rejected") || err?.message?.includes("denied")) {
        setMessage("Transaction was rejected. Please try again and approve the transaction in MetaMask.");
      } else {
        setMessage(`Failed to grant stats access: ${err?.shortMessage || err?.message || "Unknown error"}.`);
      }
    } finally {
      setSharing(false);
    }
  }, [walletClient, address, contract.address, contract.abi, shareAddress]);

  const contractStateCards = [
    { label: "Wallet", value: address ?? "Not connected" },
    {
      label: "Chain",
      value: contract.chainName
        ? `${contract.chainName} (#${chainId ?? "?"})`
        : chainId
          ? `Unsupported (#${chainId})`
          : "Unknown",
    },
    {
      label: "Contract",
      value: contract.address ?? "No deployment for this chain",
    },
    {
      label: "FHEVM",
      value: instance
        ? `Ready (${fheStatus})`
        : walletClient
          ? `Loading (${fheStatus})`
          : "Connect wallet",
    },
  ];

  const PROCESS_STEPS = [
    {
      step: "01",
      title: "Encrypt",
      detail: "Age is encrypted locally before leaving the browser.",
    },
    {
      step: "02",
      title: "Compare",
      detail: "Smart contract checks if the ciphertext is ≥ 18 with FHE.",
    },
    {
      step: "03",
      title: "Authorize",
      detail: "Contract self-authorizes encrypted stats for each submitter.",
    },
    {
      step: "04",
      title: "Decrypt",
      detail: "Users decrypt their verdict or aggregated analysis options off-chain.",
    },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Image
                src="/age-gate-mark.svg"
                alt="CipherGate Labs"
                width={200}
                height={48}
                priority
                style={{ width: "100%", height: "auto" }}
              />
            </div>
            <p className="text-lg text-slate-200">
              Privacy-first onboarding for regulated services. Age is validated under encryption and decrypted only
              on the client, while aggregated stats stay private yet auditable.
            </p>
          </div>
          <div className="self-start">
            <ConnectButton showBalance={false} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {contractStateCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-400">{card.label}</p>
              <p className="mt-2 text-sm font-semibold text-white break-all">{card.value}</p>
            </div>
          ))}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-cyan-200/20 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Submit Age (Encrypted)</h2>
              <p className="text-sm text-slate-300">
                CipherGate only needs to know whether you are an adult. Everything else stays private.
              </p>
            </div>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              Closed-loop MVP
            </span>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <label className="text-sm font-medium text-slate-200">
              Your age (never sent in the clear)
              <input
                type="number"
                min={0}
                max={120}
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-cyan-300 focus:outline-none"
                placeholder="21"
              />
            </label>
            <button
              onClick={submitAge}
              disabled={!canUseContract || !isConnected || submitting}
              className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Encrypt & Submit"}
            </button>
            <p className="text-xs text-slate-300">
              By pressing submit, you authorize the contract to grant decryption rights for your own verdict and the
              encrypted stats. Nothing else is shared on-chain.
            </p>
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">System message</p>
            <p className="mt-2 text-sm text-white">
              {message || "Waiting for interaction..."}
            </p>
            {fheError && (
              <p className="mt-2 text-xs text-rose-300">FHEVM error: {fheError.message}</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-2xl font-semibold text-white">Encrypted Processing Timeline</h2>
          <div className="mt-6 space-y-4">
            {PROCESS_STEPS.map((step) => (
              <div key={step.step} className="flex gap-4 rounded-2xl border border-white/5 bg-black/30 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-cyan-200">
                  {step.step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="text-xs text-slate-300">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-emerald-200/30 bg-emerald-400/5 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-200">Personal verdict</p>
              <h3 className="text-xl font-semibold text-white">Encrypted Decision</h3>
            </div>
            <button
              onClick={decryptDecision}
              disabled={
                !handles.decision ||
                handles.decision === ethers.ZeroHash ||
                handles.decision === "0x0000000000000000000000000000000000000000000000000000000000000000" ||
                decrypting
              }
              className="rounded-2xl border border-emerald-200/60 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-200/10 disabled:opacity-40"
            >
              {decrypting
                ? "Decrypting..."
                : !handles.decision || handles.decision === ethers.ZeroHash || handles.decision === "0x0000000000000000000000000000000000000000000000000000000000000000"
                  ? "Submit age first"
                  : "Decrypt Result"}
            </button>
          </div>
          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-slate-400">Cipher handle</p>
              <p className="break-all text-sm text-white">
                {handles.decision ?? "Not available yet"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
              <p className="text-xs text-slate-400">Decrypted status</p>
              <p className="text-2xl font-semibold text-white">
                {clearValues.decision ?? "Encrypted"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-200/30 bg-indigo-400/5 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-indigo-200">Share insights</p>
              <h3 className="text-xl font-semibold text-white">Grant encrypted stats access</h3>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <input
              type="text"
              value={shareAddress}
              onChange={(e) => setShareAddress(e.target.value)}
              placeholder="0x... viewer wallet"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-indigo-200"
            />
            <button
              onClick={shareStats}
              disabled={sharing || !shareAddress}
              className="w-full rounded-2xl border border-indigo-200/60 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-200/10 disabled:opacity-40"
            >
              {sharing ? "Granting..." : "Allow stats decryption"}
            </button>
            <p className="text-xs text-slate-300">
              Use this option when an ops wallet needs to decrypt the aggregate counters without resubmitting an age.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Encrypted analysis options</p>
            <h3 className="text-2xl font-semibold text-white">Adult vs. Minor statistics</h3>
          </div>
          <button
            onClick={refreshHandles}
            disabled={refreshing}
            className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
          >
            {refreshing ? "Refreshing..." : "Refresh handles"}
          </button>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {(["adults", "minors"] as Array<"adults" | "minors">).map((kind) => (
            <div key={kind} className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs text-slate-400">
                {kind === "adults" ? "Adult submissions" : "Minor submissions"}
              </p>
              <p className="mt-2 text-sm text-white break-all">
                {handles[kind] ?? "0x0"}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-3xl font-semibold text-white">
                  {clearValues[kind] ?? "Encrypted"}
                </p>
                <button
                  onClick={() => decryptStat(kind)}
                  disabled={!handles[kind] || decryptingStat === kind}
                  className="rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-white/10 disabled:opacity-40"
                >
                  {decryptingStat === kind ? "Decrypting..." : "Decrypt"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

