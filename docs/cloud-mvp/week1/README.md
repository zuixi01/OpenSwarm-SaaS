# Week 1 Execution Pack

This package is the implementation baseline for OpenSwarm cloud MVP.

## Files
- `schema.sql` - PostgreSQL schema (tenant/runtime/project/task/chat/artifact).
- `openapi.yaml` - API contract for cloud control plane MVP.
- `runtime-adapter.ts` - Runtime abstraction interface for local/k8s backends.
- `code-mapping.md` - Exact mapping from current local code to cloud targets.

## Quick start commands
```bash
cd panel-web
export DATABASE_URL='postgres://user:pass@host:5432/openswarm'
npm run db:migrate
npm run openapi:check
```

Optional SSL:
```bash
export DATABASE_SSLMODE=require
```

JWT bootstrap login env (for `/v1/auth/login`):
```bash
export OPENSWARM_V1_JWT_SECRET='replace-with-strong-secret'
export OPENSWARM_V1_BOOTSTRAP_EMAIL='admin@example.com'
export OPENSWARM_V1_BOOTSTRAP_PASSWORD='replace-with-strong-password'
```

## Week 1 Goals (Definition of Done)
1. Database schema is applied in dev and staging.
2. New `/v1` API namespace is scaffolded and returns valid responses.
3. Runtime adapter abstraction is introduced in codebase (compile-time wired).
4. Existing local endpoints still work in `local` mode.
5. At least one end-to-end task path writes `tasks` row and returns task status.

## Day-by-day breakdown
1. Day 1: Bootstrap infra
- Provision PostgreSQL and Redis.
- Add migration tool (recommended: `node-pg-migrate` or `prisma migrate`).
- Apply `schema.sql` to dev DB.

2. Day 2: API skeleton
- Add `/v1/auth/login`, `/v1/tenants`, `/v1/projects`, `/v1/tasks/{id}` stubs.
- Add JWT middleware with tenant scope check.

3. Day 3: Runtime adapter wiring
- Introduce `RuntimeAdapter` service layer and dependency injection.
- Implement temporary `LocalRuntimeAdapter` wrapper calling existing scripts.

4. Day 4: Task persistence
- Replace in-memory-only task state with DB-backed `tasks` writes.
- Keep existing async behavior (return taskId, poll status).

5. Day 5: Secret path
- Implement `PUT /v1/tenants/{tenantId}/secrets/{provider}`.
- Persist encrypted keys to `provider_secrets`.

## Suggested first PRs
1. PR-1: DB migrations + table models + indexes.
2. PR-2: `/v1` router + auth middleware + OpenAPI generation check.
3. PR-3: `RuntimeAdapter` interface + local adapter implementation skeleton.
4. PR-4: task repository (create/update/get) + `/v1/tasks/{taskId}` endpoint.

## Smoke tests
1. `POST /v1/tenants` returns `201`.
2. `POST /v1/projects` returns `201`.
3. `POST /v1/projects/{projectId}/chat/yin` returns `202` with `taskId`.
4. `GET /v1/tasks/{taskId}` returns status transitions: `queued -> running -> done|error`.

## Notes
- Keep current local panel APIs unchanged for now to avoid regression.
- Cloud APIs should be additive in Week 1.
- Use feature flag: `OPENSWARM_RUNTIME_MODE=local|k8s`.

## Runtime Adapter integration (PR-3)
- Local adapter implementation: `panel-web/lib/runtime-adapter.js`
- Mounted in server layer: `panel-web/server.js`
- Current mode resolution:
  - `OPENSWARM_RUNTIME_MODE=local` (default): use existing scripts/process lifecycle.
  - `OPENSWARM_RUNTIME_MODE=k8s`: adapter skeleton is present; methods are intentionally not implemented yet.

## Task repository integration (PR-4)
- Task repository: `panel-web/lib/task-repo.js`
- `/v1/tasks/:taskId` now reads via repository (DB-backed).
- New async task submit endpoint: `POST /v1/projects/:projectId/chat/yin`
  - Inserts task row (`queued` -> `running` -> `done|error`).
  - Poll with `GET /v1/tasks/:taskId`.
