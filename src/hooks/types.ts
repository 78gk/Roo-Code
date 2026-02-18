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
}

export type PostToolUseHook = (args: PostToolUseArgs) => Promise<void>
