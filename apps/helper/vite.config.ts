import { defineConfig } from "vite";

// Tauri serves the built files from dist; the dev server port is fixed so
// tauri.conf.json can point at it.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
});
