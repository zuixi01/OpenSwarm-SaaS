# Requirement Form: Phase 2 (tenant_id Full-Chain Isolation)

## 1. Basic Info

- Requirement ID: `EPIC-P2-TENANT-FULLCHAIN`
- Priority: `P0`
- Owner: Backend + data layer
- Status: Ready after Phase 1
- Goal: Ensure project/message/task/file metadata are fully tenant-scoped.

## 2. Scope

- In scope:
  - Project APIs tenant isolation
  - Chat session/message tenant isolation
  - Task lifecycle tenant isolation
  - Artifact metadata tenant isolation
  - Legacy JSON to PostgreSQL migration
  - Security test for cross-tenant access attempts
- Out of scope:
  - Cross-tenant collaboration
  - BI warehouse modeling

## 3. Functional Requirements

1. Every project row stores `tenant_id`.
2. Every chat session/message is linked to tenant/project/session.
3. Every task carries `tenant_id` and validates ownership on read/write.
4. Artifact list/download checks tenant/project ownership.
5. No API accepts raw tenant override from client for business data.

## 4. Data Model (Phase 2)

- `projects (tenant_id, created_by, config_json...)`
- `chat_sessions (tenant_id, project_id, mode...)`
- `chat_messages (tenant_id, session_id, role, content...)`
- `tasks (tenant_id, project_id, agent_id, status...)`
- `artifacts (tenant_id, project_id, task_id, storage_key...)`

Mandatory indexes:

- `(tenant_id, created_at)`
- `(tenant_id, project_id)`
- `(tenant_id, status)` for tasks

## 5. Technical Requirements

1. Repository layer methods must receive `tenantId` argument.
2. SQL scanner in CI denies query without tenant filter for tenant tables.
3. Task cache key must include tenant (`tenant:{id}:task:{taskId}`).
4. File path prefix includes tenant (`tenants/{tenantId}/...`).

## 6. Acceptance Criteria (DoD)

1. Tenant A cannot list/read/update Tenant B resources.
2. Cross-tenant API call returns `403` or obfuscated `404`.
3. Load test (200 concurrent users) shows no data crossover.
4. Migration report confirms row counts before/after.

## 7. Risks & Mitigation

- Risk: forgotten `tenant_id` predicate.
  - Mitigation: repository abstraction + CI static check.
- Risk: cache cross-talk.
  - Mitigation: namespace key prefix by tenant.
- Risk: migration mismatch.
  - Mitigation: dry-run report + checksum table.

