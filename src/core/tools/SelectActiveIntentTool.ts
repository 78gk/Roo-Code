import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { formatResponse } from "../prompts/responses"
import { setActiveIntentId } from "../intents/selectActiveIntent"

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: { intent_id: string | null }, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks

		try {
			// Normalize: empty string behaves like clear.
			const normalized = typeof params?.intent_id === "string" ? params.intent_id.trim() : null
			await setActiveIntentId(task.cwd, normalized && normalized.length > 0 ? normalized : null)

			pushToolResult(
				normalized && normalized.length > 0 ? `Active intent set to: ${normalized}` : "Active intent cleared.",
			)
		} catch (error) {
			task.didToolFailInCurrentTurn = true
			await handleError("selecting active intent", error as Error)
			pushToolResult(formatResponse.toolError("Failed to select active intent."))
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
