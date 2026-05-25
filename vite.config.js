import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/the-last-variable/",
  plugins: [react()],
  build: {
    outDir: "web-dist"
  }
});
