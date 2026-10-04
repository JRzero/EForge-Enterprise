# Versioned EForge artifacts

These are package artifacts built from
`JRzero/EForge@a7b644b724f4264c1ca015ce4c686ca94476d62f`, using its frozen
upstream lockfile and pnpm 10.0.0. The commit directory contains the provenance
manifest and SHA-256 hashes. The upstream MIT license is preserved in `LICENSE`.

Packages contain the upstream public distribution files and exported stylesheets;
the source checkout remains outside EForge Enterprise. Consumers must reference
the fixed tarballs and commit their own dependency lockfile. All eight packages
must resolve to these artifacts rather than a floating registry version.

See `docs/eforge-package-consumption.md` for rebuild and verification commands.
