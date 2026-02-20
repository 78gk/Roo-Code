import type { ToolName } from "@roo-code/types"

export type HookError = {
	type: string
	message: string
	details?: Record<string, unknown>
}

export type PreToolUseArgs = {
	cwd: string
	toolName: ToolName
	toolArgs: unknown
}

export type HookResult =
	| { kind: "continue" }
	| { kind: "blocked"; toolResult: string }
	| { kind: "handled"; toolResult: string }

export type PreToolUseHook = (args: PreToolUseArgs) => Promise<HookResult>

export type PostToolUseArgs = PreToolUseArgs & {
	toolResult: string
	/** Stable task/session identifier for trace linkage */
	taskId: string
	/** LLM model identifier used for the request that produced this tool call */
	modelId: string
}

export type PostToolUseHook = (args: PostToolUseArgs) => Promise<void>
