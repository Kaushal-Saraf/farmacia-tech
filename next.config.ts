import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Doctor documents are capped at 4 MB (Vercel's request limit is 4.5 MB).
      bodySizeLimit: "4.4mb",
    },
  },
};

export default nextConfig;
