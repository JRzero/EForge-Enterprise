import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';

export const entries=['index.html','frontend-template.html','showcase.html'];
function attribute(tag,name) {return new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`,'i').exec(tag)?.[2];}
function inside(root,file) {
  const actual=realpathSync(resolve(root,file)),name=relative(root,actual);
  if(name==='..'||name.startsWith(`..${sep}`)||isAbsolute(name))throw Error('Build resource escapes output directory');
  return actual;
}
/** Direct HTML script/preload/styles only; not network bytes or a transitive module graph. */
export function measureBuild(directory,htmlEntries=entries) {
  const root=realpathSync(directory),result={};
  for(const entry of htmlEntries) {
    const html=readFileSync(inside(root,entry),'utf8'),assets=new Set();let scripts=0;
    for(const match of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      const tag=match[0],script=/^<script\b/i.test(tag),rel=attribute(tag,'rel');
      if(!script&&!['modulepreload','stylesheet'].includes(rel))continue;
      const source=attribute(tag,script?'src':'href');if(!source)continue;
      const base=new URL(entry,'https://build.invalid/'),url=new URL(source,base);
      if(url.origin!==base.origin)throw Error('External entry resource cannot be measured locally');
      const name=decodeURIComponent(url.pathname).replace(/^\//,'');
      inside(root,name);assets.add(name);if(script)scripts++;
    }
    if(!scripts)throw Error(`No entry script found in ${entry}`);
    const files=[...assets].sort().map(name=>{const bytes=readFileSync(inside(root,name));return {name,bytes:bytes.length,gzipBytes:gzipSync(bytes).length};});
    result[entry]={bytes:files.reduce((sum,file)=>sum+file.bytes,0),gzipBytes:files.reduce((sum,file)=>sum+file.gzipBytes,0),files};
  }
  return result;
}
export function checkBudgets(report,budgets) {
  const failures=[];
  for(const [entry,value] of Object.entries(report)) {
    for(const metric of ['bytes','gzipBytes']) {
      const limit=budgets[entry]?.[metric];
      if(!Number.isSafeInteger(limit)||limit<=0)throw Error(`Missing valid ${metric} budget for ${entry}`);
      if(value[metric]>limit)failures.push(`${entry} ${metric}: ${value[metric]} > ${limit}`);
    }
  }
  return failures;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=measureBuild(fileURLToPath(new URL('../web/dist',import.meta.url)));
  console.log(JSON.stringify({scope:'direct HTML JS/CSS resources; gzip per file; excludes lazy modules, images, fonts and transport headers',entries:report},null,2));
  const index=process.argv.indexOf('--budget');
  if(index>=0){const failures=checkBudgets(report,JSON.parse(readFileSync(process.argv[index+1],'utf8')));if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}}
}
