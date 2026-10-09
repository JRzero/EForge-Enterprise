import {readFileSync, readdirSync, existsSync, lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../.agents/', import.meta.url));
const lock = JSON.parse(readFileSync(path.join(root, 'agent-skills.lock.json'), 'utf8'));
function assert(condition, message) { if (!condition) throw new Error(message); }
assert(lock.schemaVersion === 1 && /^[a-f0-9]{40}$/.test(lock.revision), 'Invalid source lock');
function files(dir) {
  return readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const target = path.join(dir, entry.name);
    assert(!entry.isSymbolicLink(), `Unexpected symlink: ${target}`);
    return entry.isDirectory() ? files(target) : [path.relative(root, target).replaceAll('\\', '/')];
  });
}
const actual = [...files(path.join(root, 'skills')), ...files(path.join(root, 'references')), 'LICENSE'].sort();
assert(JSON.stringify(actual) === JSON.stringify(Object.keys(lock.sha256).sort()), 'Installed file inventory differs from lock');
let sharedLinks = 0;
for (const file of actual) {
  assert(!path.isAbsolute(file) && !file.split('/').includes('..'), 'Unsafe locked path');
  const full = path.join(root, file);
  assert(lstatSync(full).isFile(), `Not a regular file: ${file}`);
  const bytes = readFileSync(full);
  assert(createHash('sha256').update(bytes).digest('hex') === lock.sha256[file], `Source hash mismatch: ${file}`);
  if (!file.endsWith('.md')) continue;
  for (const match of bytes.toString('utf8').matchAll(/(?:\.\.\/)+references\/[\w./-]+\.md/g)) {
    const target = path.resolve(path.dirname(full), match[0]);
    assert(target.startsWith(root) && existsSync(target), `Missing shared reference: ${file} -> ${match[0]}`);
    sharedLinks++;
  }
}
const installed = readdirSync(path.join(root, 'skills')).sort();
assert(JSON.stringify(installed) === JSON.stringify([...lock.skills].sort()), 'Skill inventory differs');
for (const name of installed) {
  const text = readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
  assert(text.startsWith('---\n') && text.includes(`\nname: ${name}\n`) && /\ndescription: .+/.test(text), `Invalid Skill metadata: ${name}`);
}
console.log(`PASS: ${installed.length} skills, ${actual.length} source files, ${sharedLinks} shared references; ${lock.revision}`);
