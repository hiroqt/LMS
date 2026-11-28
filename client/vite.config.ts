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
      const routes = ["student", "instructor", "admin"];

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
  // Meeting code loaded on demand: pre-bundled at start, so the dev server doesn't discover it
  // mid-meeting and reload the page (which ended a pre-join screen's camera and choices).
  optimizeDeps: { include: ["livekit-client", "@livekit/track-processors"] },
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
        // The PDF viewer (pdf.js, about 500 KB) is for phones that open a PDF material; it is cached
        // the first time it is used instead of being downloaded by everyone at install (D-067).
        // The meeting page with LiveKit's client (about 145 KB) needs a connection anyway; it is cached
        // the first time someone opens a meeting (D-070).
        globIgnores: ["**/PdfPages-*.js", "**/pdf.worker*", "**/MeetingRoomPage-*.js", "**/meetingBlur-*.js", "meeting-blur/**"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/(PdfPages-|pdf\.worker)/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "pdf-viewer", expiration: { maxEntries: 4, maxAgeSeconds: 90 * 24 * 60 * 60 } },
          },
          {
            // Background blur's code, WebAssembly, and model: fetched only by someone who turns blur on (D-070).
            urlPattern: ({ url }) => /\/(assets\/meetingBlur-|meeting-blur\/)/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "meeting-blur", expiration: { maxEntries: 8, maxAgeSeconds: 90 * 24 * 60 * 60 } },
          },
          {
            urlPattern: ({ url }) => /\/assets\/MeetingRoomPage-/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "meeting-page", expiration: { maxEntries: 2, maxAgeSeconds: 90 * 24 * 60 * 60 } },
          },
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
