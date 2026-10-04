import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const reference = process.argv[2];
if (!reference) throw new Error('Supply the local read-only RuoYi behavior reference checkout.');
const commit = '0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function git(...args) {
  const result = spawnSync('git', ['-C', reference, ...args], {encoding: 'utf8', maxBuffer: 5e6});
  if (result.status !== 0) throw new Error(result.stderr); return result.stdout;
}
const paths = git('ls-tree', '-r', '--name-only', commit, 'ruoyi-ui/src/assets/icons/svg').trim().split('\n');
const directory = resolve(root, 'public/ruoyi-icons/v3.9.2'); mkdirSync(directory, {recursive: true});
const icons = paths.map(path => {
  const name = path.split('/').pop().replace(/\.svg$/, '');
  if (!/^[a-zA-Z0-9_-]+$/.test(name) || !path.endsWith('.svg')) throw new Error('Invalid icon identity.');
  const source = git('show', `${commit}:${path}`);
  let normalized = source.trim().replace(/^<\?xml[^?]*\?>/, '').replace(/^<!DOCTYPE svg PUBLIC "[^"]*" "[^"]*">/, '').replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, content) => {
    if (content.replace(/@font-face\s*\{[^}]*\}/g, '').trim()) throw new Error(`Unexpected glyph stylesheet: ${name}.`);
    return '';
  }).replace(/<style\b[^>]*\/>/gi, '').trim();
  // The upstream inline SVG has one duplicate end tag; image documents require valid XML.
  if (name === 'button') normalized = normalized.replace('</path></path>', '</path>');
  if (!/^<svg\b/.test(normalized) || /<!|<\s*(script|style|foreignObject|image|iframe|use)\b|\bon[a-z]+\s*=|\b(?:href|src)\s*=|url\(\s*[^#]/i.test(normalized)) throw new Error(`Unsafe icon ${name}.`);
  if (!/^<svg\b[^>]*\bviewBox=/.test(normalized)) {
    const width = /^<svg\b[^>]*\bwidth="([0-9.]+)(?:px)?"/.exec(normalized)?.[1];
    const height = /^<svg\b[^>]*\bheight="([0-9.]+)(?:px)?"/.exec(normalized)?.[1];
    if (!width || !height || !(Number(width) > 0 && Number(height) > 0)) throw new Error(`Missing icon viewport: ${name}.`);
    normalized = normalized.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
  }
  normalized += '\n'; writeFileSync(resolve(directory, `${name}.svg`), normalized);
  return {name, sourceSha256: createHash('sha256').update(source).digest('hex'), sha256: createHash('sha256').update(normalized).digest('hex')};
});
writeFileSync(resolve(directory, 'LICENSE'), git('show', `${commit}:LICENSE`));
mkdirSync(resolve(root, 'features/menus'), {recursive: true});
writeFileSync(resolve(root, 'features/menus/icons.json'), JSON.stringify({repository: 'https://github.com/yangzongzhuan/RuoYi-Vue', commit, release: 'v3.9.2', normalization: 'Strip XML/external DTD and unused font stylesheet declarations; add a numeric viewBox when missing; repair the duplicate closing path tag in button.svg; preserve original glyph paths.', icons}, null, 2) + '\n');
writeFileSync(resolve(root, 'features/menus/icon-names.json'), JSON.stringify(icons.map(icon => icon.name)) + '\n');
console.log(`Imported ${icons.length} pinned MIT RuoYi SVG icons.`);
