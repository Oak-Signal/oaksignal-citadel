import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(__dirname);

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["tests/convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/components/setup.ts"],
        },
      },
    ],
  },
});
