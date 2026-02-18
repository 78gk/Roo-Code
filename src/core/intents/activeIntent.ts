import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"

import { fileExistsAtPath } from "../../utils/fs"

type ActiveIntentsFile = {
	active_intent_id?: string | null
	intents?: Array<{ id?: string; title?: string; summary?: string; scope?: { paths?: string[] } }>
}

/**
 * Returns true if a valid active intent is selected (active_intent_id is set and exists in intents list).
 *
 * This is used for deterministic gating of tool execution.
 */
export async function hasActiveIntentSelected(cwd: string): Promise<boolean> {
	try {
		const filePath = path.join(cwd, ACTIVE_INTENTS_RELATIVE_PATH)
		if (!(await fileExistsAtPath(filePath))) return false

		const raw = await fs.readFile(filePath, "utf-8")
		const parsed = (yaml.parse(raw) ?? {}) as ActiveIntentsFile
		const activeId = parsed.active_intent_id
		if (!activeId) return false

		return Boolean((parsed.intents ?? []).some((i) => i?.id === activeId))
	} catch {
		return false
	}
}

const ACTIVE_INTENTS_RELATIVE_PATH = path.join(".orchestration", "active_intents.yaml")

/**
 * Minimal, resilient reader for the active intent registry.
 *
 * - Never throws (returns empty string on any failure)
 * - Keeps output small (single active intent summary only)
 */
export async function getActiveIntentPromptSection(cwd: string): Promise<string> {
	try {
		const filePath = path.join(cwd, ACTIVE_INTENTS_RELATIVE_PATH)
		if (!(await fileExistsAtPath(filePath))) return ""

		const raw = await fs.readFile(filePath, "utf-8")
		const parsed = (yaml.parse(raw) ?? {}) as ActiveIntentsFile
		const activeId = parsed.active_intent_id
		if (!activeId) return ""

		const intent = (parsed.intents ?? []).find((i) => i?.id === activeId)
		if (!intent) return ""

		const title = intent.title?.trim() || activeId
		const summary = intent.summary?.trim() || ""
		const paths = intent.scope?.paths?.filter(Boolean) ?? []

		const scopeLine = paths.length > 0 ? `\nScope (paths): ${paths.join(", ")}` : ""
		const summaryLine = summary ? `\nSummary: ${summary}` : ""

		return `\n\n# Active Intent\nID: ${activeId}\nTitle: ${title}${summaryLine}${scopeLine}\n`
	} catch {
		return ""
	}
}
