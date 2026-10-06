import type {AppRoute} from '@eforge/app';

// Vite resolves these source imports at build time. Bootstrap supplies IDs only.
const compiled = import.meta.glob<{generatedRoute: AppRoute}>('../features/*/*/route.ts', {eager: true});
export const generatedBusinessRoutes = Object.values(compiled).map(module => module.generatedRoute);

export function appendGeneratedRoutes(base: readonly AppRoute[], installed: readonly AppRoute[]): AppRoute[] {
  const ids = new Set(base.map(route => route.id)), paths = new Set(base.map(route => route.path));
  for (const route of installed) {
    if (!route || !/^business-gen-[a-f0-9]{64}$/.test(route.id) || !route.path.startsWith('/business/') ||
        route.path.includes(':') || !route.component || ids.has(route.id) || paths.has(route.path)) throw new Error('Invalid compiled business route declaration.');
    const url = new URL(route.path, 'http://eforge.local');
    if (url.origin !== 'http://eforge.local' || url.pathname !== route.path || url.search || url.hash ||
        decodeURIComponent(url.pathname).includes(String.fromCharCode(92)) || decodeURIComponent(url.pathname).includes('//') ||
        [...decodeURIComponent(url.pathname)].some(character => character.codePointAt(0)! < 32 || character.codePointAt(0) === 127) ||
        decodeURIComponent(url.pathname).split('/').some(part => part === '.' || part === '..'))
      throw new Error('Invalid compiled business route path.');
    ids.add(route.id); paths.add(route.path);
  }
  return [...base, ...installed];
}