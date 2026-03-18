# Week 1 Code Mapping (Current -> Target)

## 1) Runtime lifecycle
- Current local implementation:
  - `/Users/shenwei/Documents/source/openswarm/panel-web/server.js` (`/api/open-tui/:robot`, `/api/stop/:robot`)
  - `/Users/shenwei/Documents/source/openswarm/start-worker.sh`
  - `/Users/shenwei/Documents/source/openswarm/stop-worker.sh`
- Target cloud implementation:
  - Replace direct local process/terminal spawn with `RuntimeAdapter` calls.
  - API layer should call `createRuntime/startRuntime/stopRuntime/scaleRuntime/listAgents`.

## 2) Worker registry
- Current local implementation:
  - `/Users/shenwei/Documents/source/openswarm/workers.conf`
  - `parseWorkersConf()` in `/Users/shenwei/Documents/source/openswarm/panel-web/server.js`
- Target cloud implementation:
  - Source of truth is `runtimes` + `runtime_agents` tables.
  - No static per-host port mapping.

## 3) Secret management
- Current local implementation:
  - `/Users/shenwei/Documents/source/openswarm/config.json`
  - `/Users/shenwei/Documents/source/openswarm/.env`
  - `auth-profiles.json` under `yin/` and each `hexes/*`
- Target cloud implementation:
  - Persist encrypted API keys in `provider_secrets`.
  - Runtime receives short-lived injected credentials at startup.

## 4) Data persistence
- Current local implementation:
  - JSON files in `/Users/shenwei/Documents/source/openswarm/panel-web/data`
- Target cloud implementation:
  - Move project/workflow/task/chat state to PostgreSQL tables in `schema.sql`.

## 5) Agent invocation
- Current local implementation:
  - `fetch("http://127.0.0.1:${port}/v1/chat/completions")` in `/Users/shenwei/Documents/source/openswarm/panel-web/server.js`
  - WS execution path in `/Users/shenwei/Documents/source/openswarm/panel-web/server.js` (`callHexAgentWS`)
- Target cloud implementation:
  - Resolve endpoint via runtime adapter and route through internal service network.
  - Persist task lifecycle in DB (`tasks`), not in-memory map only.

## 6) Artifacts
- Current local implementation:
  - Scan local `workspace/output/<projectId>` in `/Users/shenwei/Documents/source/openswarm/panel-web/server.js`
- Target cloud implementation:
  - Upload outputs to object storage and persist metadata in `artifacts`.

## 7) APIs to deprecate later
- `/api/open-tui/:robot`
- `/api/start-first-10`
- `/api/close-all-agent-terminals`
- `/api/stop/:robot`

These remain for local mode, but cloud mode should use `/v1/...` APIs from `openapi.yaml`.
