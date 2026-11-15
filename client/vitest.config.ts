import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Component and unit tests for new TypeScript code. Legacy *.test.js files
// use node:test and run through `npm run test:unit` instead.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
