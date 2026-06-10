import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The client is served by the Express server through Vite middleware in dev,
// and from the built dist directory in production. One process, one port.
export default defineConfig({
  root: path.resolve(import.meta.dirname, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
