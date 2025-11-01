import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CipherGate · Encrypted Age Clearance",
  description: "Verify adulthood with FHE-protected flows and RainbowKit UX.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="gradient-overlay" />
          <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 md:px-8">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
