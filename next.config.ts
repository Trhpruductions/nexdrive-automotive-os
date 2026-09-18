import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's generated client + pg driver must stay external to the server bundle
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  images: { unoptimized: true },
  // The app is opened at 127.0.0.1 (not localhost) in development
  allowedDevOrigins: ["127.0.0.1"],
  // Self-contained server for Docker (see Dockerfile)
  output: "standalone",
  // Uploaded photos can be large; keep server-action bodies generous
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
  // Baseline security headers. HSTS only matters behind HTTPS (Caddy in docker-compose terminates TLS).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self)" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
