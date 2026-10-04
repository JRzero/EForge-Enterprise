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

## Next prerequisite before creating web

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

This packaging and clean-consumer verification has not been performed yet.
The roadmap's reproducible-consumption prerequisite remains open. No frontend
dependency, upstream baseline, or Astryx product import was introduced by the
canonical login milestone.
