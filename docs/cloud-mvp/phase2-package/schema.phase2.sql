-- Phase 2 schema: tenant_id full-chain isolation for projects/messages/tasks/artifacts
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tasks
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  workflow_run_id uuid,
  runtime_agent_id uuid,
  task_type text not null check (task_type in ('chat', 'agent_task', 'tool_exec')),
  status text not null check (status in ('queued', 'running', 'done', 'error')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- chat sessions
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  mode text not null check (mode in ('yin', 'single', 'discuss')),
  created_at timestamptz not null default now()
);

-- chat messages
create table if not exists chat_messages (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  runtime_agent_id uuid,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists chat_messages add column if not exists tenant_id uuid;
alter table if exists chat_messages add column if not exists project_id uuid;

-- backfill message tenant/project from chat_sessions for legacy rows
update chat_messages m
set tenant_id = s.tenant_id,
    project_id = s.project_id
from chat_sessions s
where m.session_id = s.id
  and (m.tenant_id is null or m.project_id is null);

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'chat_messages' and column_name = 'tenant_id') then
    if not exists (select 1 from chat_messages where tenant_id is null limit 1) then
      alter table chat_messages alter column tenant_id set not null;
    end if;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_chat_messages_tenant') then
    alter table chat_messages
      add constraint fk_chat_messages_tenant
      foreign key (tenant_id) references tenants(id) on delete cascade;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_chat_messages_project') then
    alter table chat_messages
      add constraint fk_chat_messages_project
      foreign key (project_id) references projects(id) on delete set null;
  end if;
end$$;

-- artifacts
create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  storage_key text not null,
  filename text not null,
  size_bytes bigint not null default 0,
  content_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists artifacts add column if not exists task_id uuid;
alter table if exists artifacts add column if not exists storage_key text;
alter table if exists artifacts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists artifacts add column if not exists content_type text;
alter table if exists artifacts add column if not exists size_bytes bigint not null default 0;
alter table if exists artifacts add column if not exists filename text;

-- for legacy artifacts(storage_uri), copy to storage_key
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'artifacts' and column_name = 'storage_uri') then
    execute 'update artifacts set storage_key = coalesce(storage_key, storage_uri) where storage_key is null';
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_artifacts_task') then
    alter table artifacts
      add constraint fk_artifacts_task
      foreign key (task_id) references tasks(id) on delete set null;
  end if;
end$$;

create index if not exists idx_projects_tenant_created on projects(tenant_id, created_at desc);
create index if not exists idx_projects_tenant_name on projects(tenant_id, name);

create index if not exists idx_chat_sessions_tenant_created on chat_sessions(tenant_id, created_at desc);
create index if not exists idx_chat_sessions_tenant_project on chat_sessions(tenant_id, project_id, created_at desc);

create index if not exists idx_chat_messages_tenant_created on chat_messages(tenant_id, created_at desc);
create index if not exists idx_chat_messages_tenant_project on chat_messages(tenant_id, project_id, id);
create index if not exists idx_chat_messages_tenant_session on chat_messages(tenant_id, session_id, id);

create index if not exists idx_tasks_tenant_created on tasks(tenant_id, created_at desc);
create index if not exists idx_tasks_tenant_project on tasks(tenant_id, project_id, created_at desc);
create index if not exists idx_tasks_tenant_status on tasks(tenant_id, status, created_at desc);

create index if not exists idx_artifacts_tenant_created on artifacts(tenant_id, created_at desc);
create index if not exists idx_artifacts_tenant_project on artifacts(tenant_id, project_id, created_at desc);
create index if not exists idx_artifacts_tenant_task on artifacts(tenant_id, task_id, created_at desc);
