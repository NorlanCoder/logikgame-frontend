import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Needed in local dev: localhost resolves to 127.0.0.1 / ::1, which is a private IP.
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
      {
        protocol: "http",
        hostname: "192.168.1.184",
        port: "8000",
      },
    ],
  },
};

export default nextConfig;
