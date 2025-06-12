import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import { qwikEslint9Plugin } from 'eslint-plugin-qwik';

export default [
  // Base JavaScript configuration
  js.configs.recommended,
  
  // Qwik configuration
  ...qwikEslint9Plugin.configs.recommended,
  
  // Global ignores
  {
    ignores: [
      '**/*.log',
      '**/.DS_Store',
      '.vscode/',
      '.history/',
      '.yarn/',
      'bazel-*',
      'dist/',
      'dist-dev/',
      'lib/',
      'lib-types/',
      'etc/',
      'external/',
      'node_modules/',
      'temp/',
      'tsc-out/',
      'tsdoc-metadata.json',
      'target/',
      'output/',
      'rollup.config.js',
      'build/',
      '.cache/',
      '.rollup.cache/',
      'tsconfig.tsbuildinfo',
      '*.spec.tsx',
      '*.spec.ts',
      '.netlify/',
      'pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      'server/',
      'vite.config.ts',
      'vitest.config.ts',
      'postcss.config.js',
      'tailwind.config.js'
    ]
  },
  
  // TypeScript configuration
  {
    files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        browser: true,
        es2021: true,
        node: true,
        console: true,
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      
      // JavaScript rules
      'prefer-spread': 'off',
      'no-case-declarations': 'off',
      'no-console': 'off',
      'no-undef': 'off', // TypeScript handles this
    },
  },
  
  // Use TypeScript recommended rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      ...typescript.configs.recommended.rules,
      // Override specific rules as needed
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    }
  }
];