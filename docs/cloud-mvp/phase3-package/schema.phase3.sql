-- Phase 3 schema: per-tenant runtime isolation + quota + usage/billing
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists runtime_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  mode text not null default 'local' check (mode in ('local', 'k8s')),
  region text not null default 'local',
  status text not null default 'creating' check (status in ('creating', 'running', 'stopped', 'failed')),
  endpoint text,
  gateway_port int,
  state_dir text,
  pid bigint,
  desired_agents int not null default 1,
  running_agents int not null default 0,
  limits jsonb not null default '{}'::jsonb,
  heartbeat_at timestamptz,
  last_started_at timestamptz,
  last_stopped_at timestamptz,
  crash_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id),
  unique (gateway_port)
);

create table if not exists resource_quotas (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  plan_code text not null default 'free',
  max_runtimes int not null default 1,
  max_agents_per_runtime int not null default 1,
  max_concurrency int not null default 2,
  requests_per_minute int not null default 20,
  daily_request_limit int not null default 500,
  daily_budget_usd numeric(12,4) not null default 0,
  cpu_limit_millicores int not null default 1000,
  memory_limit_mb int not null default 2048,
  recycle_idle_minutes int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists usage_counters (
  tenant_id uuid not null references tenants(id) on delete cascade,
  metric_key text not null,
  window_type text not null check (window_type in ('minute', 'day')),
  window_start timestamptz not null,
  used int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (tenant_id, metric_key, window_type, window_start)
);

create table if not exists billing_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  event_type text not null,
  units numeric(14,4) not null default 0,
  unit_price_usd numeric(14,6) not null default 0,
  total_cost_usd numeric(14,6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_runtime_instances_status on runtime_instances(status, heartbeat_at desc);
create index if not exists idx_runtime_instances_tenant on runtime_instances(tenant_id, updated_at desc);

create index if not exists idx_usage_counters_tenant_metric on usage_counters(tenant_id, metric_key, window_type, window_start desc);
create index if not exists idx_billing_events_tenant_created on billing_events(tenant_id, created_at desc);

create or replace function phase3_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_phase3_runtime_instances_updated on runtime_instances;
create trigger tg_phase3_runtime_instances_updated
before update on runtime_instances
for each row execute function phase3_set_updated_at();

drop trigger if exists tg_phase3_resource_quotas_updated on resource_quotas;
create trigger tg_phase3_resource_quotas_updated
before update on resource_quotas
for each row execute function phase3_set_updated_at();
