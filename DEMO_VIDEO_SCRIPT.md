# TRP1 Final Demo Video Script (5 minutes)

## Goal

Demonstrate the "Master Thinker" workflow with parallel agents and governed execution:

1. intent-first handshake,
2. stale-write block,
3. scope/HITL block,
4. trace append in real-time.

## Pre-demo setup (do this before recording)

- Open repo root: `roo-code/`
- Open visible editors side-by-side:
    - `.orchestration/active_intents.yaml`
    - `.orchestration/agent_trace.jsonl`
    - `.orchestration/intent_map.md`
- Ensure branch is visible in terminal: `feature/intent-handshake`
- Keep one terminal ready for quick evidence commands.

## Timeline + action sequence (near-shot-by-shot)

### 00:00–00:25 — Intro frame

Narration:

- "This demo shows a governed AI-native IDE built by extending Roo Code with deterministic hooks, intent handshake, traceability, and optimistic locking."
  On screen:
- Show `roo-code` project tree and `.orchestration` files.

### 00:25–01:00 — Show active intent sidecar

Narration:

- "The orchestration layer is sidecar-driven. Active intents define owned scope and constraints."
  On screen:
- Open `.orchestration/active_intents.yaml`
- Highlight `INT-001` and scope fields.

### 01:00–01:45 — Agent B blocked without intent (handshake gate)

Narration:

- "Before any write, the agent must declare an intent via `select_active_intent`."
  Action:
- In chat panel B, ask to write code immediately without selecting intent.
  Expected result:
- Tool action is blocked with handshake error.
  Proof callout:
- Mention pre-hook enforcement in `src/hooks/pre-execution.ts`.

### 01:45–02:35 — Scope/HITL guardrails

Narration:

- "Once intent is selected, writes are still constrained by scope and destructive commands require human approval."
  Action A (scope):
- Attempt write to out-of-scope path.
  Expected result:
- Scope violation block.
  Action B (HITL):
- Ask agent to run destructive command (e.g., `rm -rf` equivalent test command).
  Expected result:
- Native Approve/Reject prompt appears; click Reject.
- Agent receives rejection and must recover.

### 02:35–03:35 — Parallel stale-write rejection (core concurrency proof)

Narration:

- "Now two panels simulate parallel workers. Agent A updates a file first; Agent B tries stale write."
  Action:
- Agent A reads then writes a target file in-scope.
- Without re-reading, Agent B writes old assumption to same file.
  Expected result:
- Stale File error in Agent B due to optimistic locking.
  Follow-up:
- Agent B re-reads file, retries write, succeeds.

### 03:35–04:25 — Trace append in real time

Narration:

- "Every successful mutation appends immutable trace metadata with content hashes."
  Action:
- Show `.orchestration/agent_trace.jsonl` before and after successful write.
- Point to `related` intent ID and `content_hash` fields.

### 04:25–04:50 — Evidence log and tests

Narration:

- "Automated evidence supports the interactive demo."
  On screen:
- Open `FINAL_PROOF_WORKFLOW.md`
- Open `report-assets/final-proof-test-output-v2.txt`
- Highlight `7 passed` files and `23 passed` tests.

### 04:50–05:00 — Close

Narration:

- "This implementation meets rubric requirements for hook architecture, context engineering, intent-AST traceability, and engineering quality."
  On screen:
- Open `RUBRIC_EVIDENCE_CHECKLIST.md` and scroll quickly through checkmarks.

---

## Backup commands (if needed during recording)

- `git log -3 --oneline`
- `pnpm.cmd exec vitest run hooks/__tests__/preExecutionHook.day3.spec.ts hooks/__tests__/preExecutionHook.day5-locking.spec.ts hooks/__tests__/agentTrace.day4.spec.ts`

## Delivery tips (important)

- Keep font size large enough for labels (`intent_id`, `content_hash`, `Stale File`).
- Speak while actions happen; avoid silent waiting.
- If a step fails, keep recording and show recovery (this often improves credibility).
