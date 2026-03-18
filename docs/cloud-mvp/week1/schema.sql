-- OpenSwarm Cloud MVP (Week 1) PostgreSQL schema
-- Target: PostgreSQL 14+

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references users(id),
  plan text not null default 'free',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  user_id uuid not null references users(id),
  tenant_id uuid not null references tenants(id),
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create table if not exists runtimes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  mode text not null check (mode in ('local', 'k8s')),
  region text not null,
  status text not null check (status in ('creating', 'running', 'stopped', 'failed')),
  namespace text,
  desired_agents int not null default 1,
  running_agents int not null default 0,
  gateway_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists runtime_agents (
  id uuid primary key default gen_random_uuid(),
  runtime_id uuid not null references runtimes(id) on delete cascade,
  agent_key text not null,
  role text not null check (role in ('coordinator', 'worker')),
  status text not null check (status in ('pending', 'running', 'failed', 'stopped')),
  endpoint text,
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (runtime_id, agent_key)
);

create table if not exists provider_secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  provider text not null,
  key_ciphertext bytea not null,
  dek_wrapped bytea not null,
  key_last4 text not null,
  key_version int not null default 1,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  description text,
  status text not null default 'active',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_agents (
  project_id uuid not null references projects(id) on delete cascade,
  runtime_agent_id uuid not null references runtime_agents(id),
  skills jsonb not null default '[]'::jsonb,
  primary key (project_id, runtime_agent_id)
);

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  definition jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('manual', 'schedule', 'webhook')),
  status text not null check (status in ('queued', 'running', 'success', 'failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  project_id uuid references projects(id),
  workflow_run_id uuid references workflow_runs(id),
  runtime_agent_id uuid references runtime_agents(id),
  task_type text not null check (task_type in ('chat', 'agent_task', 'tool_exec')),
  status text not null check (status in ('queued', 'running', 'done', 'error')),
  input jsonb not null,
  output jsonb,
  error text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  project_id uuid references projects(id),
  mode text not null check (mode in ('yin', 'single', 'discuss')),
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id bigserial primary key,
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  runtime_agent_id uuid references runtime_agents(id),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  project_id uuid references projects(id),
  workflow_run_id uuid references workflow_runs(id),
  runtime_agent_id uuid references runtime_agents(id),
  storage_uri text not null,
  filename text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

-- Optional but practical: transactional outbox for async dispatch
create table if not exists outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_memberships_tenant on memberships(tenant_id);
create index if not exists idx_runtimes_tenant on runtimes(tenant_id);
create index if not exists idx_runtime_agents_runtime on runtime_agents(runtime_id);
create index if not exists idx_provider_secrets_tenant on provider_secrets(tenant_id);
create index if not exists idx_projects_tenant on projects(tenant_id);
create index if not exists idx_workflows_project on workflows(project_id);
create index if not exists idx_workflow_runs_workflow on workflow_runs(workflow_id, created_at desc);
create index if not exists idx_tasks_tenant on tasks(tenant_id, created_at desc);
create index if not exists idx_tasks_status on tasks(status, created_at asc);
create index if not exists idx_chat_sessions_project on chat_sessions(project_id, created_at desc);
create index if not exists idx_chat_messages_session on chat_messages(session_id, id);
create index if not exists idx_artifacts_project on artifacts(project_id, created_at desc);
create index if not exists idx_outbox_pending on outbox_events(status, created_at asc);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_runtimes_updated_at on runtimes;
create trigger tg_runtimes_updated_at
before update on runtimes
for each row execute function set_updated_at();

drop trigger if exists tg_runtime_agents_updated_at on runtime_agents;
create trigger tg_runtime_agents_updated_at
before update on runtime_agents
for each row execute function set_updated_at();

drop trigger if exists tg_projects_updated_at on projects;
create trigger tg_projects_updated_at
before update on projects
for each row execute function set_updated_at();

drop trigger if exists tg_workflows_updated_at on workflows;
create trigger tg_workflows_updated_at
before update on workflows
for each row execute function set_updated_at();
