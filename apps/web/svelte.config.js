import adapter from "@sveltejs/adapter-netlify";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: { $lib: "src/lib" },
    // The helper's window is a Tauri webview; its uploads are multipart posts
    // whose Origin is the webview's, not the site's (N-0022).
    csrf: { trustedOrigins: ["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost"] },
  },
};

export default config;
