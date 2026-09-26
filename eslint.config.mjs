import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The app uses the standard "fetch-on-mount" effect pattern where an
      // async fetch helper synchronously flips a loading flag before its first
      // await. The React Compiler's set-state-in-effect rule flags this as a
      // potential cascading render, but it is intentional and correct here, so
      // we downgrade it to a warning rather than a build-breaking error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
