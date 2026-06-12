import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["stripe"],
  allowedDevOrigins: ["192.168.1.160"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
