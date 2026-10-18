import {expect,it} from 'vitest';
// @ts-expect-error Native ESM checker is shared with the lint command.
import {styleBoundaryIssues} from '../../scripts/check-style-boundaries.mjs';
it('isolates vendor DOM selectors while permitting owned component and portal styles',()=>{
  expect(styleBoundaryIssues('/web/features/list.css','.astryx-selector { color:red; }')).toHaveLength(1);
  expect(styleBoundaryIssues('/web/ui/compat/selector.css','.astryx-selector { color:red; }')).toEqual([]);
  expect(styleBoundaryIssues('/web/ui/choice.css','/* .astryx-selector */ .ui-choice [role=listbox] { color:red; }')).toEqual([]);
});
it('checks quoted and url CSS imports independently of allowed selector location',()=>{
  for(const value of ['@astryx/ui/styles.css','@eforge/ui/private/theme.css','../node_modules/@eforge/ui/styles.css'])
    for(const statement of [`@import '${value}';`,`@import url("${value}");`,`@import url(${value});`])expect(styleBoundaryIssues('/web/ui/compat/example.css',statement)).toHaveLength(1);
  expect(styleBoundaryIssues('/web/ui/theme.css',"@import '@eforge/ui/styles.css'; @import './controls.css';")).toEqual([]);
});
