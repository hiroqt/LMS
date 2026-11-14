import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dist");

function multiRoutePlugin() {
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
  plugins: [react(), multiRoutePlugin()],
});
