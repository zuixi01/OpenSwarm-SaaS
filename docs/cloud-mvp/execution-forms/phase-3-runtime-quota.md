# Requirement Form: Phase 3 (Per-Tenant Runtime + Resource Quota)

## 1. Basic Info

- Requirement ID: `EPIC-P3-RUNTIME-QUOTA`
- Priority: `P0`
- Owner: Runtime platform + backend scheduler
- Status: Ready after Phase 2
- Goal: each tenant has isolated OpenClaw runtime and enforce resource limits.

## 2. Scope

- In scope:
  - Per-tenant runtime instance management
  - Per-tenant workspace/data directory isolation
  - Dynamic port allocation and lifecycle management
  - Quota guard (requests/concurrency/cpu/memory/daily budget)
  - Idle runtime recycle and auto-wakeup
- Out of scope:
  - Multi-region traffic steering
  - GPU cluster orchestration

## 3. Functional Requirements

1. Runtime manager can `ensure/start/stop/recycle` tenant runtime.
2. Runtime metadata persists in DB and is queryable.
3. Quota guard blocks over-limit requests before task dispatch.
4. Usage counters are updated per request/task.
5. A tenant runtime failure must not impact other tenants.

## 4. Data Model (Phase 3)

- `runtime_instances (tenant_id, status, endpoint, limits, heartbeat...)`
- `resource_quotas (tenant_id, plan_code, hard/soft limits...)`
- `usage_counters (tenant_id, metric_key, window, used...)`
- `billing_events (tenant_id, event_type, units, cost...)`

## 5. Operational Requirements

1. Health checks every 30s for active runtimes.
2. Auto-recovery policy with bounded retries.
3. Idle recycle threshold configurable (e.g., 20 min).
4. Alerting on quota reject spikes and runtime crash loops.

## 6. Acceptance Criteria (DoD)

1. Two tenants run tasks concurrently with isolated runtime/workspace.
2. Quota exceeded returns deterministic error code and event logs.
3. Runtime crash auto-restarts without affecting unrelated tenants.
4. Idle recycle + wakeup path succeeds in E2E test.

## 7. Risks & Mitigation

- Risk: runtime sprawl cost.
  - Mitigation: idle recycle + plan-based limits.
- Risk: port collision/process leak.
  - Mitigation: centralized runtime manager + heartbeat sweeper.
- Risk: noisy-neighbor impact.
  - Mitigation: hard quota + isolated execution unit.

