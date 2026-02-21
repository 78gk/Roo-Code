# Intent Map

Last updated: 2026-02-21

## INT-001 — Refactor Authentication Middleware

- Status: IN_PROGRESS
- Owned scope:
    - `roo-code/src/**`
- Trace-linked implementation files:
    - `src/hooks/pre-execution.ts` (intent handshake gate, scope guard, stale-write lock, HITL gate)
    - `src/hooks/trace/agentTrace.ts` (append-only trace serializer)
    - `src/hooks/locking/readHashStore.ts` (read snapshot ledger)

## day2-handshake — Intent Handshake

- Status: COMPLETED
- Scope paths:
    - `roo-code/src/**`
    - `.orchestration/**`
- Trace-linked implementation files:
    - `src/core/assistant-message/presentAssistantMessage.ts` (pre-hook + post-hook wiring)
    - `src/core/prompts/tools/native-tools/select_active_intent.ts`
    - `src/core/tools/SelectActiveIntentTool.ts`

## Notes

- This map links business intent IDs to concrete source surfaces.
- Detailed immutable write-trace records are stored in `.orchestration/agent_trace.jsonl`.
