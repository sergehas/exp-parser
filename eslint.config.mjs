import js from "@eslint/js";
import json from "@eslint/json";
import prettierConfig from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import typescript from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "node_modules",
    "package-lock.json",
    ".husky",
    ".vscode/",
    "dist/",
    "coverage/",
  ]),

  prettierConfig,
  {
    files: ["**/*.{js,mjs,cjs}"],
    ignores: ["./build"],
    ...js.configs.recommended,
    extends: [prettierConfig],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [prettierConfig,
      ...typescript.configs.recommended,
      ...typescript.configs.stylistic],
    rules: {
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },{
      files: ["./tsconfig*.json", ".vscode/*.json"],
      language: "json/jsonc",
      extends: [prettierConfig],
      ...json.configs.recommended,
      rules: {
        "no-irregular-whitespace": "off", //bugged
      },
    },
  {
    files: ["**/*.json"],
    language: "json/json5",
    extends: [prettierConfig],
    ignores: ["**/package-lock.json"],
    ...json.configs.recommended,
    rules: {
      "no-irregular-whitespace": "off", //bugged
    },
  },
]);
