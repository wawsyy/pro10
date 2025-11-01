# Vercel Deployment Guide

## Prerequisites

1. ✅ Contract deployed on Sepolia testnet
2. ✅ ABI files generated (`abi/EncryptedAgeGateABI.ts` and `abi/EncryptedAgeGateAddresses.ts`)
3. ✅ WalletConnect Project ID configured

## Environment Variables

The following environment variable is already configured in `next.config.ts`:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: `e08e99d213c331aa0fd00f625de06e66`

If you need to change it, update `next.config.ts` or set it in Vercel dashboard.

## Vercel Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. **Import Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" → "Project"
   - Import your Git repository
   - Select the `pro10/frontend` directory as the root directory

2. **Configure Build Settings**
   - Framework Preset: **Next.js**
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

3. **Environment Variables** (if needed)
   - If you want to override `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, add it in Vercel dashboard
   - Go to Project Settings → Environment Variables

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete

### Option 2: Deploy via Vercel CLI

```bash
cd pro10/frontend
npm install -g vercel
vercel
```

Follow the prompts to deploy.

## Post-Deployment Checklist

- [ ] Verify the site loads correctly
- [ ] Test wallet connection (RainbowKit)
- [ ] Test on Sepolia testnet
- [ ] Verify FHEVM status shows "Ready"
- [ ] Test age submission flow
- [ ] Test decryption functionality

## Important Notes

1. **WalletConnect Configuration**
   - Make sure to add your Vercel deployment URL to the WalletConnect Cloud allowlist
   - Go to [WalletConnect Cloud](https://cloud.reown.com) → Your Project → Allowed Origins
   - Add: `https://your-app.vercel.app`

2. **Contract Addresses**
   - Contract addresses are hardcoded in `abi/EncryptedAgeGateAddresses.ts`
   - If you redeploy contracts, regenerate ABI files:
     ```bash
     cd pro10
     npx hardhat deploy --network sepolia
     cd frontend
     npm run genabi
     ```

3. **Build Process**
   - The build script will attempt to run `genabi` but will continue even if it fails
   - This ensures deployment works even if the contract directory is not available
   - ABI files should already be committed to the repository

## Troubleshooting

### Build Fails
- Check that ABI files exist in `frontend/abi/`
- Verify Node.js version (should be 18+)
- Check build logs in Vercel dashboard

### WalletConnect Errors
- Verify project ID is correct
- Add Vercel URL to WalletConnect Cloud allowlist
- Check browser console for specific errors

### FHEVM Not Ready
- Ensure Relayer SDK is properly loaded
- Check network connection
- Verify Sepolia RPC endpoint is accessible

