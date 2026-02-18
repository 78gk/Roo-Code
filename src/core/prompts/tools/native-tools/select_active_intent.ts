import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select (or clear) the active intent for the current workspace. This is a required handshake step before using other tools that can change state (files, commands, MCP).`

const INTENT_ID_PARAMETER_DESCRIPTION = `The intent id to activate. Use null to clear the active intent.`

export default {
	type: "function",
	function: {
		name: "select_active_intent",
		description: SELECT_ACTIVE_INTENT_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: ["string", "null"],
					description: INTENT_ID_PARAMETER_DESCRIPTION,
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
