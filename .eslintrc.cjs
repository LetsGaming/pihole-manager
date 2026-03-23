/* eslint-env node */
module.exports = {
  root: true,
  extends: [
    "plugin:vue/vue3-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "vue-eslint-parser",
  parserOptions: {
    parser: "@typescript-eslint/parser",
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    // ── TypeScript ────────────────────────────────────────────────────────────
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],

    // ── Vue: turn off purely stylistic formatting rules ───────────────────────
    // Ionic uses native shadow-DOM slot= attributes; not Vue deprecated slots
    "vue/no-deprecated-slot-attribute": "off",
    // Compact single-line templates are intentional in this codebase
    "vue/max-attributes-per-line": "off",
    "vue/singleline-html-element-content-newline": "off",
    "vue/multiline-html-element-content-newline": "off",
    "vue/html-self-closing": "off",
    "vue/html-closing-bracket-newline": "off",
    "vue/html-closing-bracket-spacing": "off",
    "vue/first-attribute-linebreak": "off",
    "vue/no-multi-spaces": "warn",
    "vue/attributes-order": "warn",
    "vue/html-indent": "warn",

    // ── General ───────────────────────────────────────────────────────────────
    "vue/multi-word-component-names": "off",
    "vue/require-default-prop": "off",
    "no-console": "off",
  },
  overrides: [
    {
      files: ["src/tests/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
};
