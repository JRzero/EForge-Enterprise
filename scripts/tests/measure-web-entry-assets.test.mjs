import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {measureBuild,checkBudgets} from '../measure-web-entry-assets.mjs';

test('counts direct unique JS/CSS bytes, excludes icons, and enforces both budgets',()=>{
  const root=mkdtempSync(join(tmpdir(),'eforge-entry-budget-'));
  try {
    writeFileSync(join(root,'index.html'),'<script src="/app.js"></script><link rel="modulepreload" href="/app.js"><link rel="stylesheet" href="./style.css"><link rel="icon" href="/missing.svg">');
    writeFileSync(join(root,'app.js'),'const x=1;');writeFileSync(join(root,'style.css'),'body{}');
    const report=measureBuild(root,['index.html']);assert.equal(report['index.html'].bytes,16);assert.equal(report['index.html'].files.length,2);
    assert.deepEqual(checkBudgets(report,{'index.html':{bytes:16,gzipBytes:1000}}),[]);
    assert.equal(checkBudgets(report,{'index.html':{bytes:15,gzipBytes:1}}).length,2);
    assert.throws(()=>checkBudgets(report,{}),/Missing valid/);
    writeFileSync(join(root,'index.html'),'<script src="https://other.invalid/app.js"></script>');assert.throws(()=>measureBuild(root,['index.html']),/External/);
    writeFileSync(join(root,'index.html'),'<link rel="icon" href="/icon.svg">');assert.throws(()=>measureBuild(root,['index.html']),/No entry script/);
    writeFileSync(join(root,'index.html'),'<script data-src="/app.js"></script>');assert.throws(()=>measureBuild(root,['index.html']),/No entry script/);
    writeFileSync(join(root,'index.html'),'<script src="/missing.js"></script>');assert.throws(()=>measureBuild(root,['index.html']),/ENOENT/);
    assert.throws(()=>measureBuild(root,['..']),/escapes output directory/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
