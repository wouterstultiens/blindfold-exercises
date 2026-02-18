import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Blindfold Chess Trainer",
        short_name: "BlindfoldTrainer",
        description: "Two-exercise blindfold trainer with synced progress across devices.",
        theme_color: "#0d1b2a",
        background_color: "#f6f7fb",
        display: "standalone",
        start_url: base,
        icons: [
          {
            src: "icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      }
    })
  ]
});
