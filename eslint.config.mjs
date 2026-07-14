import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

// Flat config (ESLint 9) compuesto directamente, sin FlatCompat: `next lint` fue removido en
// Next 16 y FlatCompat + eslint-config-next producia "Converting circular structure to JSON".
// Reglas equivalentes a next/core-web-vitals + next/typescript, con tolerancia al codebase actual.
export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Solo las reglas clasicas de hooks (equivalente a next/core-web-vitals); se evita el preset
      // moderno con reglas experimentales (purity/set-state-in-effect) que marcarian codigo legacy.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
