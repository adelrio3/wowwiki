import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const version = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

// Tauri serves the built files from dist; the dev server port is fixed so
// tauri.conf.json can point at it.
export default defineConfig({
  clearScreen: false,
  define: { __HELPER_VERSION__: JSON.stringify(version) },
  server: { port: 1420, strictPort: true },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
});
