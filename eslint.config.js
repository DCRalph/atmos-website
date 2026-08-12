import { fixupPluginRules } from "@eslint/compat";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const nextCoreWebVitalsCompat = nextCoreWebVitals.map((config) => {
  const languageOptions =
    config.name === "next"
      ? Object.fromEntries(
          Object.entries(config.languageOptions ?? {}).filter(
            ([name]) => name !== "parser",
          ),
        )
      : config.languageOptions;

  return {
    ...config,
    ...(languageOptions ? { languageOptions } : {}),
    ...(config.plugins
      ? {
          plugins: Object.fromEntries(
            Object.entries(config.plugins).map(([name, plugin]) => [
              name,
              name === "@typescript-eslint" ? plugin : fixupPluginRules(plugin),
            ]),
          ),
        }
      : {}),
  };
});

export default tseslint.config(
  {
    // `mobile` carries its own Expo lint setup; linting React Native from the
    // Next.js config trips the type-aware rules on a tsconfig they don't share.
    ignores: [".next", "mobile"],
  },
  ...nextCoreWebVitalsCompat,
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
