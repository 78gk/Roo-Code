import type { PostToolUseHook } from "./types"

import type { ToolName } from "@roo-code/types"

import { appendAgentTraceEntry } from "./trace/agentTrace"
import { recordCodebaseSearchSnapshots } from "./locking/codebaseSearchSnapshots"
import { recordSearchFilesSnapshots } from "./locking/searchFilesSnapshots"
import { recordAccessMcpResourceSnapshots } from "./locking/accessMcpResourceSnapshots"
import { recordListFilesSnapshots } from "./locking/listFilesSnapshots"

// Day 4: post-tool middleware boundary for traceability.

const WRITE_TOOLS: ReadonlySet<ToolName> = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"edit_file",
	"search_and_replace",
	"search_replace",
	"apply_patch",
	"generate_image",
])

export const postToolHook: PostToolUseHook = async (args) => {
	// Record read snapshots from other read sources (Phase 4 extension).
	try {
		await recordCodebaseSearchSnapshots({
			cwd: args.cwd,
			taskId: args.taskId,
			toolName: args.toolName,
			toolResult: args.toolResult,
		})
		await recordSearchFilesSnapshots({
			cwd: args.cwd,
			taskId: args.taskId,
			toolName: args.toolName,
			toolResult: args.toolResult,
		})
		await recordAccessMcpResourceSnapshots({
			cwd: args.cwd,
			taskId: args.taskId,
			toolName: args.toolName,
			toolArgs: args.toolArgs,
		})
		await recordListFilesSnapshots({
			cwd: args.cwd,
			taskId: args.taskId,
			toolName: args.toolName,
			toolArgs: args.toolArgs,
			toolResult: args.toolResult,
		})
	} catch {
		// best-effort
	}

	if (!WRITE_TOOLS.has(args.toolName)) return

	try {
		await appendAgentTraceEntry({
			cwd: args.cwd,
			taskId: args.taskId,
			modelId: args.modelId,
			toolName: args.toolName,
			toolArgs: args.toolArgs,
			toolResult: args.toolResult,
		})
	} catch {
		// best-effort: tracing must never break the tool loop
	}
}
