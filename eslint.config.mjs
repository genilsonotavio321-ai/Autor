import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
    ".next/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // Rascunhos locais (não versionados).
    "scratchpad/**",
    // Scripts CommonJS de ferramentas de apoio (skills e GitNexus).
    ".claude/**",
    ".gitnexus/**",
    // Gerado pelo Serwist no build.
    "public/sw.js",
    "public/swe-worker-*.js",
  ]),
];

export default eslintConfig;
