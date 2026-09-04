module.exports = {
  env: {
    node: true,
    es2021: true,
    mocha: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest"
  },
  rules: {
    // ── Errors ──────────────────────────────────────────────────
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_|^next$", varsIgnorePattern: "^_|^next$" }],
    "no-console": "warn",
    eqeqeq: ["error", "always"],
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-return-await": "warn",
    "require-await": "warn",
    "no-throw-literal": "error",

    // ── Best practices ──────────────────────────────────────────
    "no-sequences": "error",
    "no-unmodified-loop-condition": "warn",
    "no-unreachable-loop": "error",
    "prefer-const": "warn",
    "no-var": "warn",

    // ── Style (minimal — defer to Prettier for formatting) ──────
    "no-trailing-spaces": "off",
    "no-multiple-empty-lines": "off"
  },
  ignorePatterns: ["node_modules/", "uploads/", "logs/", "coverage/"]
};
