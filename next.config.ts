import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "mlixtbyhsltflysatsib.supabase.co" },
    ],
  },
};

export default nextConfig;
