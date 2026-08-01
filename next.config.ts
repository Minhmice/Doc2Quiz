import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["100.79.102.99"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  /** Avoid Windows ENOENT races on `.next/dev/cache/webpack` pack renames after cache clears. */
  webpack: (config, { dev, isServer }) => {
    if (dev && process.platform === "win32") {
      config.cache = { type: "memory" };
      if (!isServer && config.output) {
        // Large dev bundles (main-app ~12MB) can exceed default chunk load timeouts on Windows.
        config.output.chunkLoadTimeout = 300_000;
      }
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  /** Phase 37 — long-cache hashed static chunks in production only (skip in dev — Next warns on custom Cache-Control for `/_next/static`). */
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
