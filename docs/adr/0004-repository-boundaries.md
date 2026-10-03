# ADR-0004: Repository boundaries

## Status

Accepted.

## Decision

Maintain two repositories:

1. `JRzero/EForge` — reusable React frontend foundation.
2. `JRzero/EForge-Enterprise` — full-stack enterprise framework.

Do not create a separate EForge-Server repository yet.

## Reason

The backend has not yet demonstrated independent reuse outside EForge Enterprise. Extracting a third repository now would add versioning and maintenance cost before a stable shared backend abstraction exists.

## Extraction trigger

A separate server foundation may be created later only when multiple independent applications need to consume the backend foundation without the EForge Enterprise integration repository.
