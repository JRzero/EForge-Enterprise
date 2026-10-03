# ADR-0006: Modular monolith server architecture

## Status

Accepted.

## Decision

EForge Enterprise starts as a modular monolith.

Initial server modules:

```text
eforge-boot
eforge-common
eforge-framework
eforge-system
eforge-generator   optional
eforge-quartz      optional
```

## Rationale

RuoYi already provides a proven module split suitable for safe migration. Splitting each enterprise capability into its own Maven module would increase dependency and release complexity without proven value.

## Dependency direction

```text
eforge-boot
  ├─ eforge-framework
  ├─ eforge-system
  ├─ eforge-generator?
  └─ eforge-quartz?

eforge-framework
  └─ eforge-system
       └─ eforge-common
```

Exact upstream dependency edges may be preserved during import, then simplified only with tests.

## Naming

The executable former `ruoyi-admin` module is renamed to `eforge-boot`, not `eforge-admin`.

The application is an enterprise server, not merely an admin UI backend.

## Extension model

Future domain modules may use:

```text
eforge-module-crm
eforge-module-esg
eforge-module-project
```

but only in product repositories or after repeated reuse proves they belong in this framework.
