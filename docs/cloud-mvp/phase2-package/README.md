# Phase 2 Package (tenant_id Full-Chain)

## Scope

- Tenant-scoped `projects`
- Tenant-scoped `chat_sessions` + `chat_messages`
- Tenant-scoped `tasks`
- Tenant-scoped `artifacts`

## Migration

From `panel-web`:

```bash
DATABASE_URL=postgres://127.0.0.1:5432/openswarm npm run db:migrate:phase2
```

SQL file:

- `docs/cloud-mvp/phase2-package/schema.phase2.sql`

## API Updates (`/v1`)

- `POST /v1/projects` (tenant-validated create)
- `GET /v1/projects?tenantId=...`
- `GET /v1/projects/:projectId`
- `POST /v1/projects/:projectId/chat/yin`
- `GET /v1/projects/:projectId/chat/sessions`
- `GET /v1/projects/:projectId/chat/sessions/:sessionId/messages`
- `GET /v1/projects/:projectId/tasks`
- `GET /v1/projects/:projectId/artifacts`
- `GET /v1/tasks/:taskId`

## Isolation Rule

- All reads/writes above are filtered by `tenant_id`.
- Cross-tenant probing returns `404` for project/task detail endpoints.
- Business APIs do not trust client-provided tenant override beyond validated project ownership.
