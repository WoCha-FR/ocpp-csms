import { defineConfig } from "eslint/config";
import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginJsonc from 'eslint-plugin-jsonc';
import eslintPluginJsonSchemaValidator from "eslint-plugin-json-schema-validator";

export default defineConfig([
  pluginJs.configs.recommended,
  eslintConfigPrettier,
  eslintPluginJsonc.configs["flat/recommended-with-json5"],
  eslintPluginJsonSchemaValidator.configs.recommended,
  {
    ignores: ['web/public/js/*'],
  },
  {
    files: ['*.json5'],
    plugins: {
      jsonc: eslintPluginJsonc,
    },
    language: 'json/json5',
  }
]);