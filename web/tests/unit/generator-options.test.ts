import {expect,it} from 'vitest';
import {generatorMenuLabels} from '../../features/generator/options';
it('scoped orphan roots retain exact Unicode identities and function node kinds',()=>{
  const rows=[{id:'9007199254740993',parentId:'3',name:'中文目录',kind:'M'},{id:'9007199254740994',parentId:'9007199254740993',name:'<script>菜单</script>',kind:'C'},{id:'9007199254740995',parentId:'9007199254740994',name:'功能',kind:'F'}];
  expect(generatorMenuLabels(rows).map(row=>[row.id,row.label,row.kind])).toEqual([[rows[0]!.id,'中文目录','M'],[rows[1]!.id,'中文目录 / <script>菜单</script>','C'],[rows[2]!.id,'中文目录 / <script>菜单</script> / 功能','F']]);
});
it('corrupt cycles and duplicate ids fail visibly before presenting a misleading parent choice',()=>{
  expect(()=>generatorMenuLabels([{id:'1',parentId:'2',name:'a',kind:'M'},{id:'2',parentId:'1',name:'b',kind:'M'}])).toThrow('菜单层级');
  expect(()=>generatorMenuLabels([{id:'1',parentId:'0',name:'a',kind:'M'},{id:'1',parentId:'0',name:'b',kind:'M'}])).toThrow('编号重复');
});
