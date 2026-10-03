# ADR-0005: RuoYi upstream strategy

## Status

Accepted.

## Decision

RuoYi is an upstream source for backend capabilities, not the architectural identity of EForge Enterprise.

Initial implementation is derived from the RuoYi-Vue Spring Boot backend modules and must preserve required MIT license attribution.

## Preserve

- security foundation
- user/role/dept/menu
- permissions and data scope
- Redis token/session model
- logs
- dictionaries/configuration
- scheduler
- generator foundation

## Replace/refactor

- Vue frontend
- Vue route payload semantics
- component-file-path routing
- Vue generator templates
- frontend-specific branding and links

## Upstream tracking

Record the upstream repository, branch, and commit used for each import milestone so future security fixes and upstream changes can be audited.
