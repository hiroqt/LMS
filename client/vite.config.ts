import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dist");

function multiRoutePlugin(): Plugin {
  return {
    name: "multi-route-plugin",
    closeBundle() {
      const indexPath = path.join(distDir, "index.html");
      if (!fs.existsSync(indexPath)) return;

      const indexHtml = fs.readFileSync(indexPath, "utf-8");
      const routes = ["student", "instructor", "admin", "login"];

      // 1. Generate 404.html for static hosting fallback (GitHub Pages, Netlify, etc.)
      fs.writeFileSync(path.join(distDir, "404.html"), indexHtml);

      // 2. Generate role.html and role/index.html for each role route
      for (const route of routes) {
        fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtml);

        const routeDir = path.join(distDir, route);
        if (!fs.existsSync(routeDir)) {
          fs.mkdirSync(routeDir, { recursive: true });
        }
        fs.writeFileSync(path.join(routeDir, "index.html"), indexHtml);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    multiRoutePlugin(),
    // Offline app shell (Phase 4, D-019): after one visit the app opens with no
    // connection. Registered by a deferred script tag, so no JS is added to the
    // eager bundle. Disabled in the dev server.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "TMCC LMS",
        short_name: "TMCC LMS",
        description: "Classes, coursework, and grading for TMCC students and instructors.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#32806d",
        background_color: "#f7f9f8",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App code, styles, fonts, and icons are precached; large banner photos
        // are cached the first time they are shown.
        globPatterns: ["**/*.{js,css,html,svg,woff2,png}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: { cacheName: "images", expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
});
