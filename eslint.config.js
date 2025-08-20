import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nPlugin from "eslint-plugin-n";
import importPlugin from "eslint-plugin-import";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
    // Root ignore patterns
    {
        ignores: ["node_modules", "dist", "build", "coverage"],
    },

    // All TS/TSX files (syntax-only linting)
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: "module",
                // project: ["./client/tsconfig.json", "./server/tsconfig.json"], // enable type-aware linting
                // tsconfigRootDir: import.meta.url ? new URL('.', import.meta.url).pathname : process.cwd(),
            },
        },
        plugins: {
            "@typescript-eslint": tseslint,
            import: importPlugin,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
        },
    },

    // Client: React + JSX + Accessibility
    {
        files: ["client/**/*.{ts,tsx}"],
        plugins: {
            react: reactPlugin,
            "react-hooks": reactHooks,
            "jsx-a11y": jsxA11y,
        },
        rules: {
            ...reactPlugin.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            ...jsxA11y.configs.recommended.rules,
            "react/react-in-jsx-scope": "off",
        },
        settings: {
            react: { version: "detect" },
        },
    },

    // Server: Node + ESM
    {
        files: ["server/**/*.ts"],
        plugins: {
            n: nPlugin,
        },
        rules: {
            ...nPlugin.configs["recommended-module"].rules,
        },
    },
];
