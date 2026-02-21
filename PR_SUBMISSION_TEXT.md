# PR Title

TRP1 Final Submission: governed hooks, intent traceability, and final report package

# PR Body

## Summary

This PR merges the TRP1 Week 1 implementation from `feature/intent-handshake` into fork `main`.

It delivers:

- deterministic hook middleware (`PreToolUse`/`PostToolUse`)
- two-stage intent handshake (`select_active_intent`)
- scope + HITL guardrails
- AI-native traceability (`agent_trace.jsonl` with `content_hash`)
- optimistic locking and stale-write rejection
- final report artifacts and rubric/demo submission documents

## Key Artifacts

- `.orchestration/active_intents.yaml`
- `.orchestration/agent_trace.jsonl`
- `.orchestration/intent_map.md`
- `CLAUDE.md`
- `FINAL_REPORT.md`
- `FINAL_REPORT.pdf`
- `FINAL_PROOF_WORKFLOW.md`
- `RUBRIC_EVIDENCE_CHECKLIST.md`
- `DEMO_VIDEO_SCRIPT.md`

## Validation

Executed proof suite:

- `pnpm.cmd exec vitest run hooks/__tests__/agentTrace.day4.spec.ts hooks/__tests__/preExecutionHook.day3.spec.ts hooks/__tests__/preExecutionHook.day5-locking.spec.ts hooks/__tests__/optimisticLocking-codebaseSearch.spec.ts hooks/__tests__/optimisticLocking-searchFiles.spec.ts hooks/__tests__/optimisticLocking-accessMcpResource.spec.ts hooks/__tests__/optimisticLocking-listFiles.spec.ts`

Result:

- 7 test files passed
- 23 tests passed

## Notes

This PR is submission-focused and includes report packaging documents for the final deadline.
