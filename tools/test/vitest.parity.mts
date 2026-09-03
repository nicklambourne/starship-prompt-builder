import { defineConfig } from "vitest/config";

/**
 * The parity suite is separated from the unit suite because it shells out to a
 * real binary and materialises real git repositories — it is slower, and it
 * needs starship installed, so it should not be part of the fast inner loop.
 */
export default defineConfig({
  resolve: {
    alias: { "@": new URL("../../src/", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["tests/parity/**/*.test.ts"],
    // Fixtures create git repos and run a binary; give them room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
