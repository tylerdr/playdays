import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlayDays",
    short_name: "PlayDays",
    description: "Daily family activity plans, weather-smart ideas, local discovery, and calm chat help.",
    start_url: "/today",
    display: "standalone",
    background_color: "#fcf8ef",
    theme_color: "#7fa882",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
