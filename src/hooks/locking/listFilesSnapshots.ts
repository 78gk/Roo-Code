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

function stripListPrefix(line: string): string {
	// formatFilesList may prefix ignored/protected paths.
	// Remove any leading non-path marker (e.g., lock/shield emoji) + whitespace.
	return line.replace(/^[^\w./-]+\s+/u, "").trim()
}

export function extractFilePathsFromListFilesOutput(output: string): string[] {
	// formatFilesList outputs newline-separated entries and may append a truncation note.
	const lines = output.split(/\r?\n/).map((l) => l.trim())
	const entries: string[] = []
	for (const line of lines) {
		if (!line) continue
		if (line.startsWith("(") && line.includes("File list truncated")) continue
		if (line === "No files found." || line === "No files found") continue
		const cleaned = stripListPrefix(line)
		if (!cleaned) continue
		// Skip directories (they end with '/')
		if (cleaned.endsWith("/")) continue
		entries.push(cleaned)
	}
	return [...new Set(entries)]
}

export async function recordListFilesSnapshots(input: {
	cwd: string
	taskId: string
	toolName: ToolName
	toolArgs: unknown
	toolResult: string
}): Promise<void> {
	if (input.toolName !== "list_files") return

	const intentId = await resolveActiveIntentId(input.cwd)
	if (!intentId) return

	const relDir = typeof (input.toolArgs as any)?.path === "string" ? String((input.toolArgs as any).path) : ""
	const dirNorm = relDir.trim() === "" ? "." : relDir.trim()

	const entries = extractFilePathsFromListFilesOutput(input.toolResult)
	if (entries.length === 0) return

	const MAX_FILES = 50
	for (const entry of entries.slice(0, MAX_FILES)) {
		const relPath = path.posix.normalize(
			(dirNorm === "." ? entry : path.posix.join(dirNorm.split(path.sep).join(path.posix.sep), entry)).replace(
				/^[.][\/]/,
				"",
			),
		)

		try {
			const abs = path.join(input.cwd, relPath)
			const content = await fs.readFile(abs, "utf-8")
			readHashStore.set(
				{ taskId: input.taskId, intentId, relPath },
				{ hash: sha256Hash(content), capturedAt: new Date().toISOString(), toolName: "list_files" },
			)
		} catch {
			// best-effort
		}
	}
}
