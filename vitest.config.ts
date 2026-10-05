import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "$env/dynamic/private": here("./apps/web/test/env-stub.ts"),
      $lib: here("./apps/web/src/lib"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/src/**/*.test.ts", "tools/*/src/**/*.test.ts"],
    environment: "node",
  },
});
