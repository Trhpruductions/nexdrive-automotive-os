import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's generated client + pg driver must stay external to the server bundle
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  images: { unoptimized: true },
  // The app is opened at 127.0.0.1 (not localhost) in development
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
