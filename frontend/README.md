# CipherGate Frontend

Encrypted Age Clearance is a RainbowKit + Next.js dashboard that mirrors the on-chain `EncryptedAgeGate` contract. It guides users through the four-step privacy loop (input → encrypt → compare ≥ 18 → decrypt personal/statistical results) and mirrors the product polish of the reference apps in `/zama-9`.

## Highlights
- **RainbowKit wallet** pinned to the top-right corner with its official stylesheet.
- **FHEVM helpers** (`/fhevm`, `useFhevm`, `FhevmDecryptionSignature`) reused from the shared toolkit.
- **Stat cards** let the user decrypt separate analysis options (Adult vs. Minor submissions) and optionally grant visibility to other operators with `allowStats`.
- **Custom brand** (CipherGate Labs) with bespoke favicon + SVG logo stored under `public/`.

## Getting Started

```bash
cd pro10/fhe-age-check/frontend
npm install
npm run genabi   # reads ../deployments data
npm run dev
```

Open http://localhost:3000 and connect with RainbowKit (Hardhat + Sepolia are pre-configured). Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` if you need your own WalletConnect project; otherwise the bundled demo ID is used.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js (Turbopack) in development |
| `npm run build` | Production build |
| `npm run lint` | Next.js lint rules |
| `npm run genabi` | Sync ABI + addresses from the Hardhat workspace |

## Folder Notes
- `app/` – App Router pages, layout, global CSS, and the custom favicon (`icon.svg`).
- `components/AgeVerificationExperience.tsx` – End-to-end business experience (hero, flow cards, stats, forms).
- `hooks/useEthersSigner.ts` – Converts a Wagmi `walletClient` into an `ethers` signer used by the FHEVM relayer.
- `public/age-gate-mark.svg` – Dedicated product logo used by the navigation bar.

## License
BSD-3-Clause-Clear — see the root LICENSE file. All documentation and UI copy are written in English per project requirements.
