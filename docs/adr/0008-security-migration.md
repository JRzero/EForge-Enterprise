# ADR-0008: Security migration policy

## Status

Accepted.

## Decision

Security-sensitive RuoYi behavior is migrated in two stages: parity first, hardening second.

## Preserve initially

- Spring Security method authorization
- JWT/Redis login state semantics
- password hashing behavior
- user/role permission evaluation
- backend data-scope enforcement

## Security-critical legacy areas

### Data scope

The current implementation builds SQL fragments from trusted server-side role/user metadata and inserts them into mapper queries. It is tightly coupled to the existing mapper model and MySQL behavior.

Do not rewrite this mechanism during baseline import.

Required before claiming parity:

- all-data scope test
- custom-department scope test
- current-department scope test
- department-and-children scope test
- self-only scope test
- disabled-role behavior test
- no-applicable-role returns no data test

### Operational consoles

Production defaults must not expose Swagger/OpenAPI UI or Druid consoles anonymously.

### Token configuration

Secrets and token settings must not use repository production defaults.

## Future hardening

After parity, evaluate:

- newer JWT library/API
- typed data-scope policy instead of raw SQL fragment propagation
- database-portable organization hierarchy queries
- stronger session/device management

These are separate changes from the initial migration.
