import type { ToolName } from "@roo-code/types"

export type ReadHashKey = {
	taskId: string
	intentId: string
	relPath: string
}

export type ReadHashRecord = {
	hash: string
	capturedAt: string
	toolName: ToolName
}

function toKeyString(key: ReadHashKey): string {
	return `${key.taskId}::${key.intentId}::${key.relPath}`
}

/**
 * In-memory store for read-time file hashes (optimistic locking).
 *
 * This is intentionally ephemeral (per extension host process).
 */
class ReadHashStore {
	private readonly map = new Map<string, ReadHashRecord>()

	get(key: ReadHashKey): ReadHashRecord | undefined {
		return this.map.get(toKeyString(key))
	}

	set(key: ReadHashKey, record: ReadHashRecord): void {
		this.map.set(toKeyString(key), record)
	}

	clearTask(taskId: string): void {
		for (const k of this.map.keys()) {
			if (k.startsWith(`${taskId}::`)) this.map.delete(k)
		}
	}
}

export const readHashStore = new ReadHashStore()
