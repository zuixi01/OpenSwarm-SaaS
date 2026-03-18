-- Phase 1 schema: auth + tenant core
-- PostgreSQL 14+

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references users(id),
  plan_code text not null default 'free',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  provider_subject text not null,
  email text,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subject),
  unique (user_id, provider)
);

create table if not exists auth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  tenant_id uuid,
  user_id uuid,
  action text not null,
  target_type text,
  target_id text,
  ip text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenant_members_tenant on tenant_members(tenant_id);
create index if not exists idx_tenant_members_user on tenant_members(user_id);
create index if not exists idx_user_identities_user on user_identities(user_id);
create index if not exists idx_refresh_user on auth_refresh_tokens(user_id);
create index if not exists idx_refresh_tenant on auth_refresh_tokens(tenant_id);
create index if not exists idx_refresh_expires on auth_refresh_tokens(expires_at);
create index if not exists idx_audit_tenant_created on audit_logs(tenant_id, created_at desc);
create index if not exists idx_audit_user_created on audit_logs(user_id, created_at desc);

create or replace function phase1_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_phase1_users_updated_at on users;
create trigger tg_phase1_users_updated_at
before update on users
for each row execute function phase1_set_updated_at();

drop trigger if exists tg_phase1_tenants_updated_at on tenants;
create trigger tg_phase1_tenants_updated_at
before update on tenants
for each row execute function phase1_set_updated_at();

drop trigger if exists tg_phase1_user_identities_updated_at on user_identities;
create trigger tg_phase1_user_identities_updated_at
before update on user_identities
for each row execute function phase1_set_updated_at();
