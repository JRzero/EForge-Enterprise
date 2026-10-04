import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default ts.config(
  {ignores: ['generated/**', 'dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**']},
  js.configs.recommended, ...ts.configs.recommended,
  {files: ['**/*.ts', '**/*.tsx'], plugins: {'react-hooks': hooks}, rules: {
    'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error'
  }},
  {languageOptions: {globals: {console: 'readonly', process: 'readonly', URL: 'readonly',
    fetch: 'readonly', Request: 'readonly', Response: 'readonly', Headers: 'readonly',
    AbortController: 'readonly', AbortSignal: 'readonly', DOMException: 'readonly', window: 'readonly',
    document: 'readonly', Storage: 'readonly', RequestInfo: 'readonly', RequestInit: 'readonly',
    HTMLInputElement: 'readonly', setTimeout: 'readonly'}}}
);
