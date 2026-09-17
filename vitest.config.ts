import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // libraries guarded with `import "server-only"` are fine to unit-test in node
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
