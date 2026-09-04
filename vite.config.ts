import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/static/gsm/",
  server: {
    host: "10.90.25.125",
    port: 5173,
    proxy: {
      "/api": "http://10.90.25.125:5000",
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "../../DBAnalit-clean/static/gsm"),
    emptyOutDir: false,
  },
});
