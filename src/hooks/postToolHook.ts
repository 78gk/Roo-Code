import type { PostToolUseHook } from "./types"

import type { ToolName } from "@roo-code/types"

import { appendAgentTraceEntry } from "./trace/agentTrace"

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
	if (!WRITE_TOOLS.has(args.toolName)) return

	try {
		await appendAgentTraceEntry({
			cwd: args.cwd,
			toolName: args.toolName,
			toolArgs: args.toolArgs,
			toolResult: args.toolResult,
		})
	} catch {
		// best-effort: tracing must never break the tool loop
	}
}
