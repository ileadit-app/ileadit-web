import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * ileadit-web's test harness (ticket W1-TESTS, 2026-09-20). Deliberately
 * separate from `next.config.ts` — this repo's tests run under plain
 * Vite/Vitest, not the Next.js dev/build pipeline, so components under test
 * never touch a real Next.js server, App Router runtime, or Firebase
 * network call. Anything that needs those (routing context, the Firebase
 * SDK, the engine callable) is mocked at the module boundary inside the
 * relevant test file — see each test file's header comment for exactly
 * where that boundary is drawn.
 *
 * `environment: "jsdom"` is required for every test in this repo so far,
 * because every current test target is a React component ("use client"
 * pages/components) — there is no server-only/Node-only test target yet.
 * If one shows up, prefer overriding the environment per-file with a
 * `// @vitest-environment node` docblock rather than changing this default.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirrors tsconfig.json's "@/*": ["./src/*"] — must be kept in sync
      // by hand; Vitest does not read tsconfig path mappings on its own.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});
