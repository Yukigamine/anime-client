import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tsuki Anime",
  applicationName: "Tsuki Anime",
  description: "Personal anime and manga tracking",
  generator: "Next.js",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tsuki Anime",
  },
};
