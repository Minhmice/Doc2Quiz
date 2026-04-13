import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  async redirects() {
    return [
      { source: "/sets/new", destination: "/new", permanent: true },
      {
        source: "/sets/new/quiz",
        destination: "/new/quiz",
        permanent: true,
      },
      {
        source: "/sets/new/flashcards",
        destination: "/new/flashcards",
        permanent: true,
      },
      {
        source: "/sets/:id/review",
        destination: "/edit/quiz/:id",
        permanent: true,
      },
      {
        source: "/sets/:id/flashcards/review",
        destination: "/edit/flashcards/:id",
        permanent: true,
      },
      {
        source: "/sets/:id/play",
        destination: "/quiz/:id",
        permanent: true,
      },
      {
        source: "/sets/:id/done",
        destination: "/quiz/:id/done",
        permanent: true,
      },
      {
        source: "/sets/:id/flashcards",
        destination: "/flashcards/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
