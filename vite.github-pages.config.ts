import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "/paper4zch/",
  root: fileURLToPath(new URL("./github-pages", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./gh-pages-dist", import.meta.url)),
    emptyOutDir: true,
  },
});

