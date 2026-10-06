// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {GeneratorCodePreview} from '../../features/generator/GeneratorCodePreview';
it('syntax preview preserves every source character as text, including hostile HTML and escaped Java/SQL strings',async()=>{
  const source='// 中文\npublic class Source { String text = "<script>window.attack=1</script><img src=x>"; int number=123; }\nSELECT \'x\\\'y\' FROM data;';
  const element=document.createElement('div'),root=createRoot(element);await act(async()=>root.render(createElement(GeneratorCodePreview,{source})));
  expect(element.querySelector('code')?.textContent).toBe(source);expect(element.querySelectorAll('script,img')).toHaveLength(0);expect(element.querySelector('.generator-code-keyword')?.textContent).toBe('public');await act(async()=>root.unmount());
});
it('large unclosed source remains complete without pathological highlighting work',async()=>{
  const source='/*'.repeat(150000)+'<script>';const element=document.createElement('div'),root=createRoot(element);await act(async()=>root.render(createElement(GeneratorCodePreview,{source})));expect(element.textContent).toBe(source);expect(element.querySelectorAll('span,script')).toHaveLength(0);await act(async()=>root.unmount());
});
