import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "e08e99d213c331aa0fd00f625de06e66",
  },
  headers() {
    // Keep COEP for FHE WASM modules, relax COOP for Base Account SDK compatibility
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ]);
  },
};

export default nextConfig;
