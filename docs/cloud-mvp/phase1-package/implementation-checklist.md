# Phase 1 Implementation Checklist

## A. Infra

- [ ] PostgreSQL is reachable from panel service.
- [ ] `DATABASE_URL` configured.
- [ ] `OPENSWARM_AUTH_JWT_SECRET` configured.

## B. Migration

- [ ] Run `node panel-web/scripts/db-migrate-phase1.js`.
- [ ] Verify tables:
  - [ ] `users`
  - [ ] `tenants`
  - [ ] `tenant_members`
  - [ ] `auth_refresh_tokens`
  - [ ] `audit_logs`

## C. API

- [ ] `/api/auth/register` works.
- [ ] `/api/auth/login` works.
- [ ] `/api/auth/refresh` works.
- [ ] `/api/auth/logout` works.
- [ ] `/api/auth/me` works.

## D. Security

- [ ] Passwords are hashed (never plaintext).
- [ ] Refresh token stored as hash only.
- [ ] Access token expiry <= 30m.
- [ ] Audit logs created for register/login/logout/refresh.

## E. Bootstrap

- [ ] Run `node panel-web/scripts/phase1-seed-bootstrap.js` if needed.
- [ ] Can login with bootstrap account.

## F. Regression

- [ ] Existing local panel pages still load.
- [ ] Existing `/api/*` features still respond.
- [ ] No crash when DB is unavailable (auth route returns clear error).

