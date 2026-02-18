import type { PreToolUseHook } from "./types"

// Day 3 scaffold: pre-tool middleware boundary.
//
// For Day 2 we already have a functional implementation in `pre-execution.ts`.
// This wrapper exists to make the interceptor/middleware structure explicit
// (engine + pre + post) for interim submission expectations.

export const preToolHook: PreToolUseHook = async (args) => {
	const { preExecutionHook } = await import("./pre-execution")
	return preExecutionHook(args)
}
