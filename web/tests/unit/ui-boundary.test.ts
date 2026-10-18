import {Linter} from 'eslint';
import {it,expect} from 'vitest';
// @ts-expect-error Local lint rule is intentionally shared as native ESM.
import {uiBoundaryRule} from '../../scripts/ui-boundary-rule.mjs';

function violations(code:string, filename=process.cwd()+'/ui/example.js') {
  return new Linter().verify(code, [{plugins:{architecture:{rules:{boundary:uiBoundaryRule}}},rules:{'architecture/boundary':'error'}}],{filename});
}
it('rejects backward dependencies through imports, exports and lazy loading',()=>{
  for(const code of ["import x from '../app/context'", "export * from '../features/users'", "export {x} from './nested/../../templates/page'", "import('../app/context')", "require('../app/context')"])
    expect(violations(code).map(item=>item.messageId)).toContain('direction');
});
it('rejects private packages without banning pinned public exports or forward composition',()=>{
  for(const source of ['@astryx/ui','@eforge/ui/internal/button','../node_modules/@eforge/ui/src/button'])
    expect(violations(`import x from '${source}'`).map(item=>item.messageId)).toContain('private');
  for(const source of ['@eforge/ui','@eforge/ui/styles.css','./controls','../generated/api'])
    expect(violations(`import x from '${source}'`)).toEqual([]);
  expect(violations("import x from '../ui/controls'",process.cwd()+'/app/example.js')).toEqual([]);
});
