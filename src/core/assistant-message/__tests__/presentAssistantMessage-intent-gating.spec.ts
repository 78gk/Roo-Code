// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-intent-gating.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"

// Ensure VS Code runtime module is mocked for vitest.
vi.mock("vscode", () => ({}))

import { presentAssistantMessage } from "../presentAssistantMessage"

vi.mock("../../../hooks/pre-execution", () => ({
	preExecutionHook: vi.fn(async ({ toolName }: { toolName: string }) => {
		if (toolName === "select_active_intent") {
			return { kind: "handled", toolResult: "<intent_context><id>intent_1</id></intent_context>" }
		}
		return {
			kind: "blocked",
			toolResult:
				"Error: You must first declare an active intent using select_active_intent(intent_id) before performing any other actions.",
		}
	}),
}))

// Mock dependencies
vi.mock("../../task/Task")
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
	isValidToolName: vi.fn((toolName: string) =>
		["read_file", "use_mcp_tool", "select_active_intent"].includes(toolName),
	),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

vi.mock("../../intents/activeIntent", () => ({
	hasActiveIntentSelected: vi.fn().mockResolvedValue(false),
}))

// select_active_intent is now handled by preExecutionHook (src/hooks/pre-execution.ts)
// and no longer executes a dedicated tool implementation.

// Mock the tool modules to avoid executing real behavior
vi.mock("../../tools/ReadFileTool", () => ({
	readFileTool: { handle: vi.fn() },
}))
vi.mock("../../tools/UseMcpToolTool", () => ({
	useMcpToolTool: { handle: vi.fn() },
}))

// Minimal Task mock shape used by presentAssistantMessage
const createMockTask = () => {
	return {
		cwd: "/mock-cwd",
		taskId: "task_123",
		assistantMessageContent: [] as any[],
		currentStreamingContentIndex: 0,
		presentAssistantMessageLocked: false,
		presentAssistantMessageHasPendingUpdates: false,
		didCompleteReadingStream: true,
		didRejectTool: false,
		didAlreadyUseTool: false,
		userMessageContentReady: false,
		userMessageContent: [] as any[],
		consecutiveMistakeCount: 0,
		consecutiveMistakeLimit: 3,
		// tool repetition detector
		toolRepetitionDetector: { check: vi.fn().mockReturnValue({ allowExecution: true }) },
		// provider state
		providerRef: {
			deref: () => ({
				getState: vi
					.fn()
					.mockResolvedValue({ mode: "code", experiments: {}, customModes: [], disabledTools: [] }),
				getMcpHub: vi.fn().mockReturnValue(undefined),
			}),
		},
		api: { getModel: () => ({ info: {} }) },
		askName: "mock",
		recordToolUsage: vi.fn(),
		recordToolError: vi.fn(),
		pushToolResultToUserContent: vi.fn(),
		say: vi.fn(),
		ask: vi.fn(),
		checkpointSave: vi.fn(),
		currentStreamingDidCheckpoint: false,
	} as any
}

describe("presentAssistantMessage intent gating", () => {
	let mockTask: any

	beforeEach(() => {
		mockTask = createMockTask()
		vi.clearAllMocks()
	})

	it("blocks tool_use execution when no active intent is selected", async () => {
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_123",
				name: "read_file",
				params: { path: "file.txt" },
				nativeArgs: { path: "file.txt" },
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		expect(mockTask.pushToolResultToUserContent).toHaveBeenCalledTimes(1)
		const call = mockTask.pushToolResultToUserContent.mock.calls[0][0]
		expect(call).toMatchObject({ type: "tool_result", tool_use_id: "tool_call_123", is_error: true })
		expect(String(call.content)).toContain("must first declare an active intent")
	})

	it("blocks mcp_tool_use execution when no active intent is selected", async () => {
		mockTask.assistantMessageContent = [
			{
				type: "mcp_tool_use",
				id: "mcp_tool_call_123",
				name: "mcp--server--tool",
				serverName: "server",
				toolName: "tool",
				arguments: { a: 1 },
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		expect(mockTask.pushToolResultToUserContent).toHaveBeenCalledTimes(1)
		const call = mockTask.pushToolResultToUserContent.mock.calls[0][0]
		expect(call).toMatchObject({ type: "tool_result", tool_use_id: "mcp_tool_call_123", is_error: true })
		expect(String(call.content)).toContain("must first declare an active intent")
	})

	it("allows select_active_intent tool_use execution when no active intent is selected", async () => {
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_select_intent_123",
				name: "select_active_intent",
				params: { intent_id: "intent_1" },
				nativeArgs: { intent_id: "intent_1" },
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		// Should not be blocked by the intent gate; preExecutionHook will handle it.
		expect(mockTask.pushToolResultToUserContent).toHaveBeenCalledTimes(1)

		const pushed = mockTask.pushToolResultToUserContent.mock.calls[0][0]
		expect(String(pushed.content)).toContain("<intent_context>")
	})

	it("does not spam tool_result for partial blocks while intent missing", async () => {
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_partial_123",
				name: "read_file",
				params: { path: "file.txt" },
				nativeArgs: { path: "file.txt" },
				partial: true,
			},
		]

		await presentAssistantMessage(mockTask)

		expect(mockTask.pushToolResultToUserContent).not.toHaveBeenCalled()
	})
})
