-- Phase 2 schema: project state / memory / autonomy runtime
-- PostgreSQL 14+

create table if not exists project_documents (
  project_id text not null,
  tenant_id text not null,
  kind text not null check (kind in ('project_config', 'hex_definition')),
  document jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, project_id, kind)
);

create table if not exists project_memories (
  project_id text not null,
  tenant_id text not null,
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, project_id)
);

create table if not exists autonomous_runs (
  run_id text not null,
  tenant_id text not null,
  project_id text not null,
  status text not null,
  current_agent_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, run_id)
);

create index if not exists idx_project_documents_tenant_kind on project_documents(tenant_id, kind, updated_at desc);
create index if not exists idx_project_memories_tenant_updated on project_memories(tenant_id, updated_at desc);
create index if not exists idx_autonomous_runs_tenant_project on autonomous_runs(tenant_id, project_id, updated_at desc);
create index if not exists idx_autonomous_runs_tenant_status on autonomous_runs(tenant_id, status, updated_at desc);

drop trigger if exists tg_project_documents_updated_at on project_documents;
create trigger tg_project_documents_updated_at
before update on project_documents
for each row execute function phase1_set_updated_at();

drop trigger if exists tg_project_memories_updated_at on project_memories;
create trigger tg_project_memories_updated_at
before update on project_memories
for each row execute function phase1_set_updated_at();

drop trigger if exists tg_autonomous_runs_updated_at on autonomous_runs;
create trigger tg_autonomous_runs_updated_at
before update on autonomous_runs
for each row execute function phase1_set_updated_at();
