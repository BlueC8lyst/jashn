import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "components/**/*.tsx", "app/api/**/*.ts"],
      reporter: ["text-summary", "text"],
    },
  },
});
