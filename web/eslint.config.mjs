import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default ts.config(
  {ignores: ['generated/**', '**/generated-client.ts', 'dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**']},
  js.configs.recommended, ...ts.configs.recommended,
  {files: ['**/*.ts', '**/*.tsx'], plugins: {'react-hooks': hooks}, rules: {
    'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error'
  }},
  {files: ['app/**/*.{ts,tsx}', 'features/**/*.{ts,tsx}', 'templates/**/*.{ts,tsx}'], rules: {
    'no-restricted-imports': ['error', {paths: ['@eforge/ui', '@eforge/data', '@eforge/patterns'].map(name => ({name, message: 'Use the product public entry in web/ui so presentation stays consistent.'}))}],
    'no-restricted-syntax': ['error', {
      selector: 'JSXOpeningElement[name.type="JSXIdentifier"][name.name=/^(input|button|select|textarea|table)$/]',
      message: 'Use a public control or native adapter from web/ui.'
    }]
  }},
  {languageOptions: {globals: {console: 'readonly', process: 'readonly', URL: 'readonly',
    fetch: 'readonly', Request: 'readonly', Response: 'readonly', Headers: 'readonly',
    AbortController: 'readonly', AbortSignal: 'readonly', DOMException: 'readonly', window: 'readonly',
    document: 'readonly', Storage: 'readonly', RequestInfo: 'readonly', RequestInit: 'readonly',
    HTMLInputElement: 'readonly', setTimeout: 'readonly'}}}
);
