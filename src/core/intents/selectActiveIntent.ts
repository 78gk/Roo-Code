import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"

import { fileExistsAtPath, createDirectoriesForFile } from "../../utils/fs"

type ActiveIntentsFile = {
	active_intent_id?: string | null
	intents?: Array<{ id?: string; title?: string; summary?: string }>
}

const ACTIVE_INTENTS_RELATIVE_PATH = path.join(".orchestration", "active_intents.yaml")

async function readActiveIntentsFile(filePath: string): Promise<ActiveIntentsFile> {
	try {
		if (!(await fileExistsAtPath(filePath))) return { active_intent_id: null, intents: [] }
		const raw = await fs.readFile(filePath, "utf-8")
		return (yaml.parse(raw) ?? {}) as ActiveIntentsFile
	} catch {
		return { active_intent_id: null, intents: [] }
	}
}

async function writeActiveIntentsFile(filePath: string, data: ActiveIntentsFile): Promise<void> {
	await createDirectoriesForFile(filePath)
	await fs.writeFile(filePath, yaml.stringify(data, { lineWidth: 0 }), "utf-8")
}

export async function setActiveIntentId(cwd: string, intentId: string | null): Promise<void> {
	const filePath = path.join(cwd, ACTIVE_INTENTS_RELATIVE_PATH)
	const data = await readActiveIntentsFile(filePath)
	data.active_intent_id = intentId
	data.intents = Array.isArray(data.intents) ? data.intents : []
	await writeActiveIntentsFile(filePath, data)
}

export async function listIntentChoices(cwd: string): Promise<Array<{ id: string; label: string }>> {
	const filePath = path.join(cwd, ACTIVE_INTENTS_RELATIVE_PATH)
	const data = await readActiveIntentsFile(filePath)
	return (data.intents ?? [])
		.map((i) => ({ id: i.id ?? "", label: i.title?.trim() || i.id?.trim() || "" }))
		.filter((x) => Boolean(x.id) && Boolean(x.label))
}
