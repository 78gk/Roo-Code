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

function tryResolveWorkspaceRelPathFromFileUri(cwd: string, uri: string): string | null {
	if (!uri.startsWith("file://")) return null

	try {
		const decoded = decodeURIComponent(uri.replace(/^file:\/\//, ""))
		// On Windows, file URIs can come through as /C:/...
		const fsPath = decoded.startsWith("/") && /^[A-Za-z]:\//.test(decoded.slice(1)) ? decoded.slice(1) : decoded
		const normalized = path.normalize(fsPath)
		const rel = path.relative(cwd, normalized)
		if (rel.startsWith("..") || (path.isAbsolute(rel) === false && rel.includes(":"))) return null
		return rel.split(path.sep).join(path.posix.sep)
	} catch {
		return null
	}
}

export async function recordAccessMcpResourceSnapshots(input: {
	cwd: string
	taskId: string
	toolName: ToolName
	toolArgs: unknown
}): Promise<void> {
	if (input.toolName !== "access_mcp_resource") return

	const uri = (input.toolArgs as any)?.uri
	if (typeof uri !== "string" || uri.trim().length === 0) return

	const relPath = tryResolveWorkspaceRelPathFromFileUri(input.cwd, uri.trim())
	if (!relPath) return

	const intentId = await resolveActiveIntentId(input.cwd)
	if (!intentId) return

	try {
		const abs = path.join(input.cwd, relPath)
		const content = await fs.readFile(abs, "utf-8")
		readHashStore.set(
			{ taskId: input.taskId, intentId, relPath },
			{ hash: sha256Hash(content), capturedAt: new Date().toISOString(), toolName: "access_mcp_resource" },
		)
	} catch {
		// best-effort
	}
}
