import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"

import type { ToolName } from "@roo-code/types"

import { sha256Hash } from "../../utils/hash"
import { readHashStore } from "./readHashStore"

const ACTIVE_INTENTS_RELATIVE_PATH = path.join(".orchestration", "active_intents.yaml")

type ActiveIntentsFileAny = {
	active_intent_id?: string | null
}

async function resolveActiveIntentId(cwd: string): Promise<string | null> {
	try {
		const filePath = path.join(cwd, ACTIVE_INTENTS_RELATIVE_PATH)
		const raw = await fs.readFile(filePath, "utf-8")
		const parsed = (yaml.parse(raw) ?? {}) as ActiveIntentsFileAny
		return typeof parsed.active_intent_id === "string" && parsed.active_intent_id.trim().length > 0
			? parsed.active_intent_id.trim()
			: null
	} catch {
		return null
	}
}

export function extractFilePathsFromSearchFilesOutput(output: string): string[] {
	// regexSearchFiles() formats results with section headers: "# <relative/path>"
	const results: string[] = []
	const re = /^#\s+(.+)\s*$/gm
	let m: RegExpExecArray | null
	while ((m = re.exec(output)) !== null) {
		const p = m[1]?.trim()
		if (p) results.push(p)
	}
	return [...new Set(results)]
}

export async function recordSearchFilesSnapshots(input: {
	cwd: string
	taskId: string
	toolName: ToolName
	toolResult: string
}): Promise<void> {
	if (input.toolName !== "search_files") return

	const intentId = await resolveActiveIntentId(input.cwd)
	if (!intentId) return

	const filePaths = extractFilePathsFromSearchFilesOutput(input.toolResult)
	if (filePaths.length === 0) return

	// Bound the work to avoid accidental large reads.
	const MAX_FILES = 20
	for (const relPath of filePaths.slice(0, MAX_FILES)) {
		try {
			const abs = path.join(input.cwd, relPath)
			const content = await fs.readFile(abs, "utf-8")
			readHashStore.set(
				{ taskId: input.taskId, intentId, relPath },
				{ hash: sha256Hash(content), capturedAt: new Date().toISOString(), toolName: "search_files" },
			)
		} catch {
			// best-effort
		}
	}
}
