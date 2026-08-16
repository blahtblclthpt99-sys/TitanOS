import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

const reactRules = {
  "no-unused-vars": "off",
  "react/jsx-uses-vars": "error",
  "react/jsx-uses-react": "error",
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "warn",
    {
      vars: "all",
      varsIgnorePattern: "^_",
      args: "after-used",
      argsIgnorePattern: "^_",
    },
  ],
  "react/prop-types": "off",
  "react/react-in-jsx-scope": "off",
  "react/no-unknown-property": [
    "error",
    { ignore: ["cmdk-input-wrapper", "toast-close"] },
  ],
  "react-hooks/rules-of-hooks": "error",
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/release/**",
      "**/android/**",
      "**/.tools/**",
      // API is Node/serverless — lint separately when Node globals block is ready
      "**/api/**",
      // Generated / vendor-style shadcn primitives (adopt or prune intentionally)
      "src/components/ui/**",
    ],
  },
  {
    files: [
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/hooks/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
      "src/App.jsx",
      "src/main.jsx",
      "src/AuthenticatedShell.jsx",
    ],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: "detect" } },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: reactRules,
  },
  {
    // Temporary, file-scoped exception while the 2nd Me integration is release-gated.
    // Keeps global unused-import enforcement intact and exposes deeper functional gates.
    files: ["src/pages/AIAssistant.jsx"],
    rules: {
      "unused-imports/no-unused-imports": "off",
    },
  },
  {
    // Pure libs — catch dead imports without React JSX rules noise
    files: ["src/lib/**/*.{js,mjs,cjs}"],
    ...pluginJs.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
