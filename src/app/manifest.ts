import type { MetadataRoute } from "next";

/** Installable on phones and bay tablets ("Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NexDrive Automotive OS",
    short_name: "NexDrive",
    description: "Complete automotive business management software",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0f19",
    theme_color: "#0b0f19",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
