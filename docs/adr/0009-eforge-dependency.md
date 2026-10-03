# ADR-0009: EForge dependency strategy

## Status

Accepted with implementation prerequisite.

## Decision

EForge remains a separate repository and versioned dependency.

Do not copy EForge source into EForge Enterprise.

Current architecture baseline pins EForge commit:

```text
a7b644b724f4264c1ca015ce4c686ca94476d62f
```

Before Phase 2 web implementation, establish a reproducible package-consumption mechanism.

Preferred order:

1. versioned package registry release
2. versioned package artifacts
3. temporary read-only Git submodule only if registry publication is not yet available

A floating dependency on `main` is not allowed in CI.

## Reason

The full-stack framework must be reproducible and must not silently change when EForge main advances.
