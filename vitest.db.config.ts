import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/setup/empty-module.ts")
    }
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/db/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    pool: "forks"
  }
});
