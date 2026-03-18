# Requirement Form: Phase 1 (Login/Tenant/Auth + DB Migration)

## 1. Basic Info

- Requirement ID: `EPIC-P1-AUTH-TENANT-DB`
- Priority: `P0`
- Owner: Platform backend
- Status: Ready for implementation
- Goal: Build cloud-ready user identity and tenant boundary as the base of multi-tenant SaaS.

## 2. Scope

- In scope:
  - User registration/login/refresh/logout
  - Tenant creation and membership bootstrap
  - JWT access + refresh token flow
  - PostgreSQL schema migration for auth/tenant core tables
  - Auth middleware (`requireAuth`, `requireTenantContext`)
  - Audit log for key security events
- Out of scope:
  - SSO, OAuth social login
  - Advanced RBAC policy engine
  - Billing enforcement

## 3. Functional Requirements

1. User can register with email/password and auto-create a personal tenant.
2. User can login and receive `accessToken` + `refreshToken`.
3. User can refresh access token using refresh token.
4. User can logout and invalidate refresh token.
5. Every protected API reads `tenant_id` from auth context, not from client body.
6. Every auth operation writes audit record.

## 4. Data Model (Phase 1)

- `users`
- `tenants`
- `tenant_members`
- `auth_refresh_tokens`
- `audit_logs`

Key constraints:

- `users.email` unique
- `tenant_members (tenant_id, user_id)` unique
- refresh token only stores hash (`token_hash`) and supports revocation

## 5. API Contract (MVP)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## 6. Non-Functional Requirements

1. Password hash must be one-way strong hash (scrypt/argon2/bcrypt).
2. Access token expiry <= 30 min (default 15 min).
3. Refresh token must be revocable and auditable.
4. Auth API p95 < 300ms under 100 RPS in staging.

## 7. Acceptance Criteria (DoD)

1. Unauthenticated protected request returns `401`.
2. Register+login+refresh+logout full flow passes integration test.
3. Token replay after logout fails.
4. Tenant context is available in request middleware.
5. Migration script is idempotent.

## 8. Risks & Mitigation

- Risk: Missing auth secret in prod.
  - Mitigation: startup health check + fail fast.
- Risk: Token leakage.
  - Mitigation: short access TTL + hashed refresh token + revoke list.
- Risk: Endpoint break for existing local mode.
  - Mitigation: additive routes + feature flag.

