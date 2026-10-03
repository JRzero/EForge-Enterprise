# ADR-0003: Menu and route contract

## Status

Accepted.

## Decision

Do not reuse RuoYi's Vue component-path dynamic routing contract.

Backend menu assignment and frontend route implementation are separate concerns linked by a stable `routeId`.

## Backend owns

- which navigation entries a user may see
- order
- hierarchy
- permission association
- status/visibility
- external link metadata

## Frontend owns

- React component
- concrete route path
- page metadata
- route registration

## Security

A hidden menu is not an authorization rule.

Backend `@PreAuthorize` and data-scope checks remain mandatory.

## Migration note

The original `sys_menu.component` field may remain temporarily for compatibility while a new `route_id` contract is introduced. New React code must not depend on `component`.
