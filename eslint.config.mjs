import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Unused scaffold from the original AI web-dev template — not imported
    // by the Next.js app (app/, lib/, components/) and excluded from
    // tsconfig.json's type-check scope too. See README.md §4.
    "client/**",
    "server/**",
    "shared/**",
    "drizzle/**",
    "drizzle.config.ts",
    "vite.config.ts",
    "vite.config.ts.bak",
    "vitest.config.ts",
    // Deno edge functions — different runtime/lint conventions, not part
    // of the Next.js app; linted separately if needed via `deno lint`.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
