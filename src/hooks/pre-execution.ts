import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"

import type { ToolName } from "@roo-code/types"

import * as vscode from "vscode"

import { fileExistsAtPath, createDirectoriesForFile } from "../utils/fs"

import { isPathWithinScope } from "./policy/intentScope"
import { classifyCommandRisk } from "./policy/commandRisk"
import { readHashStore } from "./locking/readHashStore"
import { sha256Hash } from "../utils/hash"

const ACTIVE_INTENTS_RELATIVE_PATH = path.join(".orchestration", "active_intents.yaml")

type IntentFromPlanDoc = {
	id?: string
	name?: string
	owned_scope?: string[]
	constraints?: string[]
}

type IntentFromRepoSchema = {
	id?: string
	// repo schema (what we currently store)
	title?: string
	summary?: string
	scope?: { paths?: string[] }
	constraints?: string[]
	// allow plan doc style fields even if stored under intents
	name?: string
	owned_scope?: string[]
}

type ActiveIntentsFileAny = {
	active_intent_id?: string | null
	// Plan-doc shape
	active_intents?: IntentFromPlanDoc[]
	// Repo shape
	intents?: IntentFromRepoSchema[]
}

const WRITE_TOOLS_REQUIRING_SCOPE_CHECK: ReadonlySet<ToolName> = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"edit_file",
	"search_and_replace",
	"search_replace",
	"apply_patch",
	"generate_image",
])

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

type ActiveIntentResolved = { id: string; title: string; constraints: string[]; scopePaths: string[] }

function resolveActiveIntent(data: ActiveIntentsFileAny): ActiveIntentResolved | null {
	const activeId = data.active_intent_id
	if (!activeId) return null
	const intent = findIntent(data, activeId)
	if (!intent) return null
	return { id: activeId, ...intent }
}

export type PreExecutionHookResult =
	| { kind: "continue" }
	| { kind: "blocked"; toolResult: string }
	| { kind: "handled"; toolResult: string }

function escapeXml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;")
}

async function readActiveIntentsFile(cwd: string): Promise<{ filePath: string; data: ActiveIntentsFileAny }> {
	const filePath = path.join(cwd, ACTIVE_INTENTS_RELATIVE_PATH)
	if (!(await fileExistsAtPath(filePath))) {
		return { filePath, data: {} }
	}

	try {
		const raw = await fs.readFile(filePath, "utf-8")
		return { filePath, data: (yaml.parse(raw) ?? {}) as ActiveIntentsFileAny }
	} catch {
		return { filePath, data: {} }
	}
}

async function writeActiveIntentsFile(filePath: string, data: ActiveIntentsFileAny): Promise<void> {
	await createDirectoriesForFile(filePath)
	await fs.writeFile(filePath, yaml.stringify(data, { lineWidth: 0 }), "utf-8")
}

function findIntent(
	data: ActiveIntentsFileAny,
	intentId: string,
): { title: string; constraints: string[]; scopePaths: string[] } | null {
	const fromRepo = (data.intents ?? []).find((i) => i?.id === intentId)
	if (fromRepo) {
		const title = fromRepo.title?.trim() || fromRepo.name?.trim() || intentId
		const constraints = (fromRepo.constraints ?? []).filter(Boolean)
		const scopePaths = (fromRepo.scope?.paths ?? fromRepo.owned_scope ?? []).filter(Boolean)
		return { title, constraints, scopePaths }
	}

	const fromPlan = (data.active_intents ?? []).find((i) => i?.id === intentId)
	if (fromPlan) {
		const title = fromPlan.name?.trim() || intentId
		const constraints = (fromPlan.constraints ?? []).filter(Boolean)
		const scopePaths = (fromPlan.owned_scope ?? []).filter(Boolean)
		return { title, constraints, scopePaths }
	}

	return null
}

function buildIntentContextXml(input: {
	id: string
	title: string
	constraints: string[]
	scopePaths: string[]
}): string {
	const constraintsXml =
		input.constraints.length > 0
			? `\n  <constraints>\n${input.constraints.map((c) => `    <constraint>${escapeXml(c)}</constraint>`).join("\n")}\n  </constraints>`
			: ""
	const scopeXml =
		input.scopePaths.length > 0
			? `\n  <scope>\n${input.scopePaths.map((p) => `    <path>${escapeXml(p)}</path>`).join("\n")}\n  </scope>`
			: ""

	return `<intent_context>\n  <id>${escapeXml(input.id)}</id>\n  <title>${escapeXml(input.title)}</title>${constraintsXml}${scopeXml}\n</intent_context>`
}

export async function preExecutionHook(args: {
	cwd: string
	taskId: string
	toolName: ToolName
	toolArgs: unknown
}): Promise<PreExecutionHookResult> {
	const { cwd, toolName, taskId } = args

	// Gatekeeper: block *all* tools except the handshake tool until an intent is selected.
	if (toolName !== "select_active_intent") {
		const { data } = await readActiveIntentsFile(cwd)
		const active = resolveActiveIntent(data)

		if (!active) {
			return {
				kind: "blocked",
				toolResult:
					"Error: You must first declare an active intent using select_active_intent(intent_id) before performing any other actions.",
			}
		}

		// Phase 4 (Day 5): Optimistic locking.
		// Record read-time hash for read_file so later writes can detect staleness.
		if (toolName === "read_file") {
			const relPath = (args.toolArgs as any)?.path
			if (typeof relPath === "string" && relPath.trim().length > 0) {
				try {
					const abs = path.join(cwd, relPath)
					const content = await fs.readFile(abs, "utf-8")
					const hash = sha256Hash(content)
					readHashStore.set(
						{ taskId, intentId: active.id, relPath },
						{ hash, capturedAt: new Date().toISOString(), toolName },
					)
				} catch {
					// If read fails, do not record.
				}
			}
		}

		// Day 4: Enforce explicit attribution fields for write tools.
		if (WRITE_TOOLS_REQUIRING_SCOPE_CHECK.has(toolName)) {
			const toolIntentId = (args.toolArgs as any)?.intent_id
			const mutationClass = (args.toolArgs as any)?.mutation_class

			if (typeof toolIntentId !== "string" || toolIntentId.trim().length === 0) {
				return {
					kind: "blocked",
					toolResult:
						"Error: Write tools must include intent_id (must match the currently selected active intent).",
				}
			}

			if (mutationClass !== "AST_REFACTOR" && mutationClass !== "INTENT_EVOLUTION") {
				return {
					kind: "blocked",
					toolResult:
						"Error: Write tools must include mutation_class of either AST_REFACTOR or INTENT_EVOLUTION.",
				}
			}

			if (toolIntentId.trim() !== active.id) {
				return {
					kind: "blocked",
					toolResult: `Error: intent_id mismatch. Tool intent_id '${toolIntentId.trim()}' does not match active intent '${active.id}'.`,
				}
			}

			const relPath = getToolRelPath(toolName, args.toolArgs)

			// Day 3: Intent-owned scope enforcement for write tools.
			if (relPath && active.scopePaths.length > 0) {
				const allowed = isPathWithinScope({ cwd, relPath, scopeGlobs: active.scopePaths })
				if (!allowed) {
					return {
						kind: "blocked",
						toolResult: `Error: Out-of-scope write blocked. Path '${relPath}' is not within the active intent scope. Allowed scope globs: ${active.scopePaths.join(", ")}`,
					}
				}
			} else if (relPath && active.scopePaths.length === 0) {
				return {
					kind: "blocked",
					toolResult:
						"Error: Out-of-scope write blocked. Active intent has no declared owned_scope/scope.paths; refusing to write.",
				}
			}

			// Phase 4 (Day 5): stale write rejection.
			if (relPath) {
				const stored = readHashStore.get({ taskId, intentId: active.id, relPath })
				if (!stored) {
					return {
						kind: "blocked",
						toolResult: `Error: Stale File. No read snapshot recorded for '${relPath}'. You must call read_file on this path before writing to it.`,
					}
				}

				try {
					const abs = path.join(cwd, relPath)
					const current = await fs.readFile(abs, "utf-8")
					const currentHash = sha256Hash(current)
					if (currentHash !== stored.hash) {
						return {
							kind: "blocked",
							toolResult: `Error: Stale File. '${relPath}' has changed since last read. Re-read the file (read_file) and re-apply your change.`,
						}
					}
				} catch {
					return {
						kind: "blocked",
						toolResult: `Error: Stale File. Unable to verify current state of '${relPath}'. Re-read and retry.`,
					}
				}
			}
		}

		// Day 3: HITL gating for destructive commands.
		if (toolName === "execute_command") {
			const command = (args.toolArgs as any)?.command
			if (typeof command === "string" && classifyCommandRisk(command) === "destructive") {
				const selection = await vscode.window.showWarningMessage(
					`Destructive command requested: ${command}`,
					{ modal: true },
					"Approve",
					"Reject",
				)

				if (selection !== "Approve") {
					return {
						kind: "blocked",
						toolResult: `Error: Destructive command rejected by user: ${command}`,
					}
				}
			}
		}

		return { kind: "continue" }
	}

	// Handshake interception.
	const intentId = (args.toolArgs as { intent_id?: unknown } | undefined)?.intent_id
	if (typeof intentId !== "string" || intentId.trim().length === 0) {
		return {
			kind: "handled",
			toolResult: "Error: You must cite a valid active Intent ID.",
		}
	}

	const normalizedId = intentId.trim()
	const { filePath, data } = await readActiveIntentsFile(cwd)
	const intent = findIntent(data, normalizedId)
	if (!intent) {
		return {
			kind: "handled",
			toolResult: `Error: You must cite a valid active Intent ID. Unknown intent_id: ${normalizedId}`,
		}
	}

	// Persist selection for subsequent turns.
	data.active_intent_id = normalizedId
	await writeActiveIntentsFile(filePath, data)

	return {
		kind: "handled",
		toolResult: buildIntentContextXml({
			id: normalizedId,
			title: intent.title,
			constraints: intent.constraints,
			scopePaths: intent.scopePaths,
		}),
	}
}
