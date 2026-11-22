const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
 { ignores: ['dist/**', 'out-tsc/**', '.angular/**', 'node_modules/**'] },
 {
  files: ['src/**/*.ts', 'e2e/**/*.ts'],
  extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
  processor: angular.processInlineTemplates,
  rules: {
   // Existing API contracts use dynamic payloads; retain the previous no-any policy.
   '@typescript-eslint/no-explicit-any': 'off',
   // The modernization deliberately preserves NgModules and constructor injection.
   '@angular-eslint/prefer-standalone': 'off',
   '@angular-eslint/prefer-inject': 'off',
   '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
   '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }]
  }
 },
 { files: ['src/**/*.html'], extends: [...angular.configs.templateRecommended] }
);
