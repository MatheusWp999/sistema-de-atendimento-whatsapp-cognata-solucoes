import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "ws",
    "bufferutil",
    "utf-8-validate",
    "libsignal",
    "whatsapp-rust-bridge",
    "pdf-parse",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
