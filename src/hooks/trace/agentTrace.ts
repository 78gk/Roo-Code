import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "yaml"
import * as crypto from "crypto"
import { execFile } from "child_process"
import { promisify } from "util"

import type { ToolName } from "@roo-code/types"

import { createDirectoriesForFile, fileExistsAtPath } from "../../utils/fs"
import { sha256Hash } from "../../utils/hash"

const execFileAsync = promisify(execFile)

const ACTIVE_INTENTS_RELATIVE_PATH = path.join(".orchestration", "active_intents.yaml")
const AGENT_TRACE_RELATIVE_PATH = path.join(".orchestration", "agent_trace.jsonl")

type IntentFromPlanDoc = { id?: string; name?: string }
type IntentFromRepoSchema = { id?: string; title?: string; name?: string }

type ActiveIntentsFileAny = {
	active_intent_id?: string | null
	active_intents?: IntentFromPlanDoc[]
	intents?: IntentFromRepoSchema[]
}

async function readActiveIntentsFile(cwd: string): Promise<ActiveIntentsFileAny> {
	const filePath = path.join(cwd, ACTIVE_INTENTS_RELATIVE_PATH)
	if (!(await fileExistsAtPath(filePath))) return {}
	try {
		const raw = await fs.readFile(filePath, "utf-8")
		return (yaml.parse(raw) ?? {}) as ActiveIntentsFileAny
	} catch {
		return {}
	}
}

function resolveActiveIntentId(data: ActiveIntentsFileAny): string | null {
	const activeId = data.active_intent_id
	if (!activeId) return null
	const inRepo = (data.intents ?? []).some((i) => i?.id === activeId)
	const inPlan = (data.active_intents ?? []).some((i) => i?.id === activeId)
	return inRepo || inPlan ? activeId : null
}

function getToolRelPath(toolName: ToolName, toolArgs: unknown): string | null {
	const args = toolArgs as any
	switch (toolName) {
		case "write_to_file":
		case "apply_diff":
		case "generate_image":
			return typeof args?.path === "string" ? args.path : null
		case "edit":
		case "edit_file":
		case "search_and_replace":
		case "search_replace":
			return typeof args?.file_path === "string" ? args.file_path : null
		case "apply_patch":
			return typeof args?.path === "string" ? args.path : null
		default:
			return null
	}
}

function getHashedContentForTool(toolName: ToolName, toolArgs: unknown): string | null {
	const args = toolArgs as any
	if (toolName === "write_to_file") {
		return typeof args?.content === "string" ? args.content : null
	}
	if (toolName === "apply_diff") {
		// We don't have the final patched region here; hash the diff payload for now.
		return typeof args?.diff === "string" ? args.diff : null
	}
	// Best-effort: if toolArgs includes a direct content field.
	return typeof args?.content === "string" ? args.content : null
}

async function getGitRevisionId(cwd: string): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd, timeout: 2000 })
		const rev = String(stdout ?? "").trim()
		return rev.length > 0 ? rev : null
	} catch {
		return null
	}
}

export type AgentTraceAppendInput = {
	cwd: string
	toolName: ToolName
	toolArgs: unknown
	toolResult: string
}

export async function appendAgentTraceEntry(input: AgentTraceAppendInput): Promise<void> {
	const relPath = getToolRelPath(input.toolName, input.toolArgs)
	if (!relPath) return

	const active = resolveActiveIntentId(await readActiveIntentsFile(input.cwd))
	if (!active) return

	const toolIntentId =
		typeof (input.toolArgs as any)?.intent_id === "string" ? String((input.toolArgs as any).intent_id).trim() : null
	const mutationClassRaw = (input.toolArgs as any)?.mutation_class
	const mutationClass =
		mutationClassRaw === "AST_REFACTOR" || mutationClassRaw === "INTENT_EVOLUTION" ? mutationClassRaw : null

	// Prefer tool-provided attribution; fall back to active intent for backward compat.
	const resolvedIntentId = toolIntentId && toolIntentId.length > 0 ? toolIntentId : active

	// Defense-in-depth: never append a trace entry that contradicts active intent.
	if (toolIntentId && toolIntentId.length > 0 && toolIntentId !== active) return

	const contentForHash = getHashedContentForTool(input.toolName, input.toolArgs)
	if (contentForHash === null) return

	const contentHash = sha256Hash(contentForHash)
	const lineCount = contentForHash.replace(/\r\n/g, "\n").split("\n").length

	const revisionId = await getGitRevisionId(input.cwd)

	const entry: Record<string, unknown> = {
		schema_version: "1.0",
		event_type: "tool_write",
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		...(revisionId ? { vcs: { revision_id: revisionId } } : {}),
		files: [
			{
				relative_path: relPath,
				conversations: [
					{
						url: "session_log_id",
						tool: {
							name: input.toolName,
						},
						contributor: {
							entity_type: "AI",
							model_identifier: "unknown",
						},
						ranges: [
							{
								start_line: 0,
								end_line: Math.max(0, lineCount - 1),
								content_hash: contentHash,
							},
						],
						mutation_class: mutationClass ?? "UNKNOWN",
						related: [
							{
								type: "specification",
								value: resolvedIntentId,
							},
						],
					},
				],
			},
		],
	} as const

	const tracePath = path.join(input.cwd, AGENT_TRACE_RELATIVE_PATH)
	await createDirectoriesForFile(tracePath)
	await fs.appendFile(tracePath, `${JSON.stringify(entry)}\n`, "utf-8")
}
