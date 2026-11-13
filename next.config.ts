import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Old address of the partner page, kept so shared links still work.
    return [{ source: "/for-clinics", destination: "/for-pharmacies", permanent: true }];
  },
  experimental: {
    serverActions: {
      // Doctor documents are capped at 4 MB (Vercel's request limit is 4.5 MB).
      bodySizeLimit: "4.4mb",
    },
  },
};

export default nextConfig;
