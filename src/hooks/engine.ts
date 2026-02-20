import type { HookResult, PostToolUseHook, PreToolUseHook, PreToolUseArgs } from "./types"

import { preToolHook } from "./preToolHook"
import { postToolHook } from "./postToolHook"

export type HookEngine = {
	preToolUse: PreToolUseHook
	postToolUse: PostToolUseHook
}

export const hookEngine: HookEngine = {
	preToolUse: preToolHook,
	postToolUse: postToolHook,
}

/**
 * Convenience entry point used by the tool loop.
 * This preserves the existing Day 2 behavior while making
 * the middleware boundary explicit for Phase 2+.
 */
export async function runPreToolUseHook(args: PreToolUseArgs): Promise<HookResult> {
	return hookEngine.preToolUse(args)
}

export async function runPostToolUseHook(args: import("./types").PostToolUseArgs): Promise<void> {
	return hookEngine.postToolUse(args)
}
