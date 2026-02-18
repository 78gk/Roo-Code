import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"

import type { ToolName } from "@roo-code/types"

import { fileExistsAtPath, createDirectoriesForFile } from "../utils/fs"

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
	toolName: ToolName
	toolArgs: unknown
}): Promise<PreExecutionHookResult> {
	const { cwd, toolName } = args

	// Gatekeeper: block *all* tools except the handshake tool until an intent is selected.
	if (toolName !== "select_active_intent") {
		const { data } = await readActiveIntentsFile(cwd)
		const activeId = data.active_intent_id
		if (!activeId || !findIntent(data, activeId)) {
			return {
				kind: "blocked",
				toolResult:
					"Error: You must first declare an active intent using select_active_intent(intent_id) before performing any other actions.",
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
