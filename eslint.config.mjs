import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { files: ["**/*.{js,mjs,cjs,ts}"], languageOptions: { globals: globals.node } },
  { files: ["**/*.{js,mjs,cjs,ts}"], plugins: { js }, extends: ["js/recommended"] },
  tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-inferrable-types': [
				'error',
				{
					ignoreParameters: true
				}
			],
		
			indent: ['error', 'tab'],
			'linebreak-style': ['error', 'unix'],
			quotes: ['error', 'single'],
			semi: ['error', 'always'],
		
			'brace-style': ['error', '1tbs', { allowSingleLine: true }],
			eqeqeq: ['error', 'always'],
			curly: ['error', 'multi-or-nest'],
			'multiline-ternary': ['error', 'always'],
			'no-tabs': ['error', { allowIndentationTabs: true }]
		},
		ignores: ['dist'],
	}
]);
