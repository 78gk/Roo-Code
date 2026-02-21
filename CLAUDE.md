# Shared Brain (CLAUDE.md)

## Architectural Rules

- Always perform intent handshake (`select_active_intent`) before any mutating tool.
- PreToolUse is the authorization boundary; PostToolUse is the evidence boundary.
- Never bypass scope enforcement for write-capable tools.
- Keep injected intent context minimal: constraints + scope only.

## Lessons Learned

- Deterministic hook enforcement is more reliable than prompt-only control.
- Optimistic locking must reject stale writes even when line numbers still appear valid.
- Agent trace records are most useful when hashes are computed on normalized content and stored append-only.
- Scope denial and HITL rejection should return machine-parseable errors to support autonomous recovery.

## Verification Heuristics

- A write without prior `read_file` snapshot should fail with `Stale File`.
- A destructive command should require explicit user approval each time.
- A write outside `owned_scope` should fail before filesystem mutation.
- Every successful write path should append a trace record with `intent_id` and `content_hash`.
