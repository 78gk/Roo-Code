import type OpenAI from "openai"

const APPLY_DIFF_DESCRIPTION = `Apply precise, targeted modifications to an existing file using one or more search/replace blocks. This tool is for surgical edits only; the 'SEARCH' block must exactly match the existing content, including whitespace and indentation. To make multiple targeted changes, provide multiple SEARCH/REPLACE blocks in the 'diff' parameter. Use the 'read_file' tool first if you are not confident in the exact content to search for.`

const DIFF_PARAMETER_DESCRIPTION = `A string containing one or more search/replace blocks defining the changes. The ':start_line:' is required and indicates the starting line number of the original content. You must not add a start line for the replacement content. Each block must follow this format:
<<<<<<< SEARCH
:start_line:[line_number]
-------
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE`

export const apply_diff = {
	type: "function",
	function: {
		name: "apply_diff",
		description: APPLY_DIFF_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description:
						"The active intent ID this change is attributable to (must match the currently selected active intent).",
				},
				mutation_class: {
					type: "string",
					enum: ["AST_REFACTOR", "INTENT_EVOLUTION"],
					description:
						"Classification of the change: AST_REFACTOR for structurally equivalent refactors; INTENT_EVOLUTION for logic/behavior changes.",
				},
				path: {
					type: "string",
					description: "The path of the file to modify, relative to the current workspace directory.",
				},
				diff: {
					type: "string",
					description: DIFF_PARAMETER_DESCRIPTION,
				},
			},
			required: ["intent_id", "mutation_class", "path", "diff"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
