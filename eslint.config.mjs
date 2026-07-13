import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      'chrome-extension-sync/**',
      'node_modules/**',
      'dist/**',
      'popup/**',
      'newtab/**'
    ]
  },
  {
    files: ['backend/**/*.js', 'tests/**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        console: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['shared/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        chrome: 'readonly',
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        window: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
]
