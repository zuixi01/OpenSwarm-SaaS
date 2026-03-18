# Phase 1 API Contract

Base URL: `http://localhost:3999`

## 1) POST /api/auth/register

Create user + personal tenant + issue tokens.

Request:

```json
{
  "email": "u1@example.com",
  "password": "Passw0rd!",
  "tenantName": "U1 Workspace"
}
```

Response `201`:

```json
{
  "user": { "id": "uuid", "email": "u1@example.com" },
  "tenant": { "id": "uuid", "name": "U1 Workspace", "role": "owner" },
  "accessToken": "jwt",
  "refreshToken": "opaque-token",
  "tokenType": "Bearer",
  "expiresIn": "15m"
}
```

## 2) POST /api/auth/login

Request:

```json
{
  "email": "u1@example.com",
  "password": "Passw0rd!",
  "tenantId": "optional-tenant-uuid"
}
```

Response `200`: same payload as register.

## 3) POST /api/auth/refresh

Request:

```json
{
  "refreshToken": "opaque-token"
}
```

Response `200`:

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-token",
  "tokenType": "Bearer",
  "expiresIn": "15m"
}
```

## 4) POST /api/auth/logout

Headers:

- `Authorization: Bearer <accessToken>`

Request:

```json
{
  "refreshToken": "opaque-token"
}
```

Response `200`:

```json
{ "ok": true }
```

## 5) GET /api/auth/me

Headers:

- `Authorization: Bearer <accessToken>`

Response `200`:

```json
{
  "user": { "id": "uuid", "email": "u1@example.com", "roles": ["member"] },
  "tenant": { "id": "uuid", "role": "owner" }
}
```

## Common error model

```json
{
  "error": "human readable message"
}
```

HTTP status:

- `400` invalid request
- `401` unauthorized
- `403` tenant access denied
- `409` conflict (email exists)
- `500` internal failure

