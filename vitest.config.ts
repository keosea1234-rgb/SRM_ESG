import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server\\**\\*.test.ts",
      "src/**/*.test.ts",
      "src\\**\\*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["server/**/*.ts"],
      exclude: ["server/**/*.test.ts", "server/index.ts"],
    },
  },
});
