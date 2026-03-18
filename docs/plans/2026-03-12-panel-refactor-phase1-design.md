# Panel Refactor Phase 1 Design

## Goal

Refactor the panel without breaking the current product surface. Phase 1 only extracts the most failure-prone runtime path:

1. worker WebSocket client
2. worker task dispatcher

The current API shape stays the same:

- `POST /api/agent/agent-task`
- `GET /api/agent/agent-task/:taskId`

## Why This Cut

The current panel mixes:

- Express routes
- autonomous run state machine
- worker connection/auth logic
- billing
- project skill mounting

The least stable and most operationally sensitive part is the worker execution chain:

- device auth
- WS connect
- `agent`
- `agent.wait`
- `chat.history`
- `sessions.preview`

That path should move out of `panel-web/server.js` first so runtime failures can be debugged independently from business logic.

## Target Structure

Phase 1 adds:

- `panel-web/lib/worker-ws-client.js`
- `panel-web/lib/worker-dispatcher.js`

Responsibilities:

- `worker-ws-client.js`
  - build device auth payloads
  - connect to gateway
  - send `agent` requests
  - wait for completion
  - recover final reply from `chat.history` and `sessions.preview`
  - emit progress callbacks

- `worker-dispatcher.js`
  - validate worker selection
  - run budget preflight
  - mount project skills
  - call WS client with retry policy
  - update task progress
  - record billing
  - persist autonomy progress hooks

## Non-Goals

Phase 1 does not yet extract:

- autonomy run store/state machine
- discuss promotion logic
- Yin review service
- frontend script splitting

## Success Criteria

- `server.js` stops owning the worker execution details
- `/api/agent/agent-task` still behaves the same to callers
- runtime failures are isolated to dedicated modules
- syntax checks pass and the panel still boots

## Next Phases

Phase 2:

- autonomy store/service/parser extraction

Phase 3:

- discuss service extraction

Phase 4:

- split `project.html` JavaScript into modules
