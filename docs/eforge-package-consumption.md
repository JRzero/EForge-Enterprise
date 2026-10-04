# EForge package consumption readiness

## Verified baseline

The architecture baseline remains
`JRzero/EForge@a7b644b724f4264c1ca015ce4c686ca94476d62f`.
The local sibling checkout matched that commit and had no working-tree changes
when inspected on 2026-10-04.

At this commit, the root workspace is private and uses `pnpm@10.0.0` with
Node >=22.13.0. `@eforge/app` and `@eforge/ui` have package version `0.1.0`,
public export declarations, and build scripts producing `dist`.
Cross-package dependencies use `workspace:*`; these must be converted by
`pnpm pack` or publication, rather than installed as raw package directories.
The inspected upstream CI verifies builds but has no package release step.

A read-only query to the public npm registry for `@eforge/app@0.1.0` returned
404. This establishes that direct public-registry installation is unavailable;
it does not establish whether a private registry release exists.

## Verified artifact consumption

Follow ADR-0009: use a versioned registry release if available, otherwise fixed
package artifacts. Build and pack in an isolated upstream checkout at the
exact baseline commit, outside this repository. Do not mutate the sibling
checkout or copy its source into EForge Enterprise.

For the artifact route:

1. Check out the exact baseline and install with the frozen upstream lockfile.
2. Build the upstream package dependency graph.
3. Use `pnpm pack` for each required package so `workspace:*` becomes a concrete
   package version. Include every transitive `@eforge/*` dependency.
4. Record the source commit, toolchain, package versions, and SHA-256 of each
   tarball in a provenance manifest. Store artifacts at a stable versioned
   location accessible by CI.
5. Install the fixed tarballs into web and lock their integrity. Verify a clean
   install, typecheck, and build without the sibling checkout.

Eight packages (`app`, `core`, `data`, `forms`, `patterns`, `schema-contract`,
`tokens`, `ui`) are now stored under
`dependencies/eforge/a7b644b724f4264c1ca015ce4c686ca94476d62f/`.
`manifest.json` records source identity, Node version, upstream lockfile hash,
and each package's SHA-256. The upstream MIT license is retained alongside them.

Rebuild with Node 24.18.0, Python 3, Git, npm and PowerShell 7:

```powershell
./scripts/prepare-eforge-packages.ps1
# Optional local clone source; the script still checks out the exact baseline:
./scripts/prepare-eforge-packages.ps1 -SourceRepository D:/Projects/EForge
```

The script clones into a task-specific temporary directory, installs the frozen
upstream lockfile, builds the dependency graph and packs with pnpm 10.0.0.
It canonicalizes archive entry ordering, tar metadata and gzip encoding without
changing any package payload, so packing order cannot alter the artifact hash.
It refuses to replace a baseline's existing artifacts with different hashes.
Two independent local builds produced identical hashes for all eight packages.

Verify consumption without any upstream source checkout:

```powershell
./scripts/verify-eforge-packages.ps1
```

This checks artifact identity, hashes and removal of `workspace:*`, then copies
only the fixture and tarballs into a temporary consumer. `npm ci` uses the
committed consumer lockfile (including registry dependency integrity). Public
types, route matching/permission behavior, public UI rendering and browser
bundling of all package and stylesheet entries pass. The same verification runs
in `.github/workflows/eforge-package-ci.yml`.

The fixture deliberately references every export, so its bundle size is not a
production size measurement. Vite reports upstream `use client` directives as
ignored in this browser-only bundle; they do not prevent the build.

The reproducible-consumption prerequisite is complete. The fixture is not the
product web application: React web initialization, generated OpenAPI client and
login/bootstrap integration remain the next milestone. Product imports continue
to use public EForge entry points, never Astryx directly.
