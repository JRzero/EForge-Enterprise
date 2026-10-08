import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {expect, it} from 'vitest';
import manifest from '../../features/menus/icons.json';
import names from '../../ui/icon-names.json';
it('ships every pinned icon with verified glyph bytes, a scalable viewport and no active/external content', () => {
  const directory = resolve('public/ruoyi-icons/v3.9.2');
  expect(manifest.commit).toBe('0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0'); expect(manifest.icons).toHaveLength(88);
  expect(names).toEqual(manifest.icons.map(icon => icon.name));
  expect(readdirSync(directory).filter(name => name.endsWith('.svg')).sort()).toEqual(manifest.icons.map(icon => `${icon.name}.svg`).sort());
  for (const icon of manifest.icons) {
    const source = readFileSync(resolve(directory, `${icon.name}.svg`), 'utf8');
    expect(createHash('sha256').update(source).digest('hex')).toBe(icon.sha256); expect(source).toMatch(/^<svg\b[^>]*\bviewBox=/);
    expect(source).not.toMatch(/<!|<\s*(script|style|foreignObject|image|iframe|use)\b|\bon[a-z]+\s*=|\b(?:href|src)\s*=|url\(\s*[^#]/i);
  }
  expect(readFileSync(resolve(directory, 'LICENSE'), 'utf8')).toContain('Copyright (c) 2018 RuoYi');
});
