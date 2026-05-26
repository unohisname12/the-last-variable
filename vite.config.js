import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // SaaS deploys at root ("/"); the GitHub Pages solo/PDF companion sets VITE_BASE=/the-last-variable/.
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  build: {
    outDir: "web-dist"
  }
});
