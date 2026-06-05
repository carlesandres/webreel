import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@webreel/core": resolve(import.meta.dirname, "../@webreel/core/src/index.ts"),
    },
  },
  test: {
    exclude: ["dist/**", "node_modules/**"],
  },
});
