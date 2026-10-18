import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function styleBoundaryIssues(filename,source) {
  const text=source.replace(/\/\*[\s\S]*?\*\//g,''),issues=[];
  const normalized=filename.replaceAll('\\','/');
  if (/\.astryx-[\w-]+/.test(text)&&!normalized.includes('/ui/compat/')) issues.push('Vendor DOM selectors belong only in ui/compat.');
  for(const match of text.matchAll(/@import\s+(?:url\(\s*(?:['"]([^'"]+)['"]|([^\s)]+))\s*\)|['"]([^'"]+)['"])/g)) {
    const specifier=match[1]??match[2]??match[3];
    if (/astryx/i.test(specifier)||/(?:^|\/)node_modules\//.test(specifier)||(/^@eforge\//.test(specifier)&&!/^@eforge\/[^/]+\/styles\.css$/.test(specifier))) issues.push('Import only public pinned dependency styles: '+specifier);
  }
  return issues;
}

function checkDirectory(directory) {
  let failures=0;
  for(const entry of readdirSync(directory,{withFileTypes:true})) {
    if(['node_modules','dist','generated','test-results','playwright-report','.git'].includes(entry.name))continue;
    const filename=path.join(directory,entry.name);
    if(entry.isDirectory())failures+=checkDirectory(filename);
    else if(entry.name.endsWith('.css'))for(const issue of styleBoundaryIssues(filename,readFileSync(filename,'utf8'))){console.error(`${filename}: ${issue}`);failures++;}
  }
  return failures;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const failures=checkDirectory(fileURLToPath(new URL('..',import.meta.url)));
  if(failures)process.exitCode=1;else console.log('PASS: source CSS uses public imports and isolated vendor DOM compatibility.');
}
