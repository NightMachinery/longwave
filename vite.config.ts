import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://127.0.0.1:3310",
      "/healthz": "http://127.0.0.1:3310",
    },
    watch: {
      ignored: [
        "**/.git/**",
        "**/build/**",
        "**/node_modules/**",
        "**/.self_host/**",
      ],
    },
  },
  build: {
    outDir: "build",
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) {
            return;
          }

          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "react";
          }

          if (
            id.includes("/i18next") ||
            id.includes("/react-i18next/")
          ) {
            return "i18n";
          }

          if (
            id.includes("/@fortawesome/") ||
            id.includes("/@tippyjs/") ||
            id.includes("/rc-slider/") ||
            id.includes("/react-tippy/") ||
            id.includes("/tippy.js/")
          ) {
            return "ui";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    pool: "threads",
    setupFiles: "./src/setupTests.ts",
  },
});
