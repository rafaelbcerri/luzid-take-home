import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Only pure modules are tested here: anything importing `@/lib/config/env`
// needs a real environment, which belongs in the manual flow, not in unit tests.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
