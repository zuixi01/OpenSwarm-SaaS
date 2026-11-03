# Phase 3 Package (Per-Tenant Runtime + Quota)

## Migration

Run from `panel-web`:

```bash
DATABASE_URL=postgres://127.0.0.1:5432/openswarm npm run db:migrate:phase3
```

Schema file:

- `docs/cloud-mvp/phase3-package/schema.phase3.sql`

## Runtime APIs (`/v1`)

- `POST /v1/tenants/:tenantId/runtimes`
- `GET /v1/tenants/:tenantId/runtimes/:runtimeId`
- `POST /v1/tenants/:tenantId/runtimes/:runtimeId/start`
- `POST /v1/tenants/:tenantId/runtimes/:runtimeId/stop`
- `POST /v1/tenants/:tenantId/runtimes/:runtimeId/scale`
- `GET /v1/tenants/:tenantId/runtimes/:runtimeId/agents`

## Quota APIs (`/v1`)

- `GET /v1/tenants/:tenantId/quota`
- `PUT /v1/tenants/:tenantId/quota` (`platform_admin` only)

## Runtime + Quota enforcement in task dispatch

`POST /v1/projects/:projectId/chat/yin` now enforces:

1. Reserve tenant quota (rpm/daily/concurrency) before dispatch.
2. Ensure tenant runtime exists and is running.
3. Route task to tenant runtime endpoint instead of shared main gateway.
4. Record usage/billing events.

## Smoke-tested outcomes

- Independent runtime per tenant created with isolated `OPENCLAW_STATE_DIR`.
- Quota exceed returns deterministic `429` with `code` (`QUOTA_RPM_EXCEEDED` etc.).
- Cross-tenant data isolation from Phase 2 remains effective.
