import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ['public/js/*'],
  },
];