import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  async redirects() {
    return [
      { source: "/sets/new", destination: "/edit/new", permanent: true },
      {
        source: "/sets/new/quiz",
        destination: "/edit/new/quiz",
        permanent: true,
      },
      {
        source: "/sets/new/flashcards",
        destination: "/edit/new/flashcards",
        permanent: true,
      },
      { source: "/new", destination: "/edit/new", permanent: true },
      {
        source: "/new/quiz",
        destination: "/edit/new/quiz",
        permanent: true,
      },
      {
        source: "/new/flashcards",
        destination: "/edit/new/flashcards",
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
