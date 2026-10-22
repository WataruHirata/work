import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}", "database/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
