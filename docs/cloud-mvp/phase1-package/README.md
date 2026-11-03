# Phase 1 Delivery Pack (Executable)

This package delivers:

1. Login/tenant/auth middleware baseline
2. PostgreSQL migration SQL
3. API contract
4. Bootstrap script for first cloud tenant account

## File List

- `schema.phase1.sql`
- `auth-api-contract.md`
- `implementation-checklist.md`
- `/panel-web/routes/phase1-auth.js`
- `/panel-web/middleware/phase1-auth.js`
- `/panel-web/lib/auth-phase1-repo.js`
- `/panel-web/lib/password-hash.js`
- `/panel-web/scripts/db-migrate-phase1.js`
- `/panel-web/scripts/phase1-seed-bootstrap.js`

## Environment Variables

Required:

- `DATABASE_URL=postgres://user:pass@host:5432/dbname`
- `OPENSWARM_AUTH_JWT_SECRET=<strong-secret>`

Optional:

- `OPENSWARM_AUTH_REFRESH_SECRET=<strong-secret>` (defaults to JWT secret)
- `OPENSWARM_AUTH_ACCESS_EXPIRES=15m`
- `OPENSWARM_AUTH_REFRESH_EXPIRES=7d`
- `DATABASE_SSLMODE=require`

## Migration

```bash
cd panel-web
node scripts/db-migrate-phase1.js
```

## Seed First Tenant Account

```bash
cd panel-web
export PHASE1_BOOTSTRAP_EMAIL=admin@example.com
export PHASE1_BOOTSTRAP_PASSWORD='replace-me'
export PHASE1_BOOTSTRAP_TENANT_NAME='Admin Workspace'
node scripts/phase1-seed-bootstrap.js
```

## Start Service

```bash
cd panel-web
node server.js
```

## Test APIs

1. Register:

```bash
curl -X POST http://localhost:3999/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"u1@example.com","password":"Passw0rd!","tenantName":"U1 Workspace"}'
```

2. Login:

```bash
curl -X POST http://localhost:3999/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"u1@example.com","password":"Passw0rd!"}'
```

3. Me:

```bash
curl http://localhost:3999/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

4. Refresh:

```bash
curl -X POST http://localhost:3999/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

5. Logout:

```bash
curl -X POST http://localhost:3999/api/auth/logout \
  -H "Authorization: Bearer <accessToken>" \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

