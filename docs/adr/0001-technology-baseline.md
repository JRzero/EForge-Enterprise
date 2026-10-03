# ADR-0001: Technology baseline

## Status

Accepted for initial implementation.

## Decision

Use the RuoYi 3.9.2 `springboot3` branch as the initial backend reference baseline:

- Java 17
- Spring Boot 3.5.x
- Spring Security
- MyBatis
- Redis
- MySQL
- Maven

Frontend uses EForge v0.4+ and React 19.

## Context

RuoYi 3.9.2 currently has both a Spring Boot 4 default branch and an official Spring Boot 3 branch. The full-stack framework is being established for reuse across multiple enterprise applications, so ecosystem stability is more important than adopting the newest major runtime immediately.

## Consequences

- Easier integration with mature Java libraries.
- Clear later upgrade path to Spring Boot 4.
- We do not promise Boot 4 compatibility in the first implementation milestone.
