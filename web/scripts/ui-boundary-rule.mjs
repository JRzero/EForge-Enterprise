import path from 'node:path';

/** Check imports and re-exports, including lazy imports, at their resolved layer. */
export const uiBoundaryRule = {
  meta: {type: 'problem', schema: [], messages: {
    private: 'Use pinned public package exports; Astryx and private dependency paths are forbidden.',
    direction: 'Pure UI must not depend on app, features or templates. Inject behavior through props.'
  }},
  create(context) {
    function check(node, source) {
      if (typeof source?.value !== 'string') return;
      const value = source.value;
      if (/astryx/i.test(value) || /(?:^|\/)node_modules\//.test(value) || /^@eforge\/[^/]+\/(?!styles\.css$)/.test(value)) {
        context.report({node, messageId: 'private'});
      }
      const filename = context.filename.replaceAll('\\', '/');
      if (!filename.includes('/web/ui/')) return;
      const resolved = value.startsWith('.') ? path.resolve(path.dirname(context.filename), value).replaceAll('\\', '/') : value;
      if (/(?:^|\/)web\/(?:app|features|templates)(?:\/|$)/.test(resolved) || /^(?:@\/|~\/)(?:app|features|templates)(?:\/|$)/.test(value)) {
        context.report({node, messageId: 'direction'});
      }
    }
    return {
      ImportDeclaration: node => check(node, node.source),
      ExportNamedDeclaration: node => check(node, node.source),
      ExportAllDeclaration: node => check(node, node.source),
      ImportExpression: node => check(node, node.source),
      CallExpression: node => {if (node.callee.type === 'Identifier' && node.callee.name === 'require') check(node, node.arguments[0]);}
    };
  }
};
