import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "doosnktiqxrvhpwmbrnu.supabase.co",
      },
      {
        protocol: "https",
        hostname: "content.instructables.com",
      },
    ],
  },
};

export default nextConfig;
