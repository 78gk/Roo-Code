import { describe, it, expect, beforeEach, vi } from "vitest"

import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

// Ensure VS Code runtime module is mocked for vitest (uses repo mock).
vi.mock("vscode", async () => await import("../../../__mocks__/vscode.js"))
import * as vscode from "vscode"

import { presentAssistantMessage } from "../presentAssistantMessage"
import { executeCommandTool } from "../../tools/ExecuteCommandTool"
import { writeToFileTool } from "../../tools/WriteToFileTool"

// Avoid pulling in real Task implementation.
vi.mock("../../task/Task")

// Ensure tool validation doesn't block these calls.
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
	isValidToolName: vi.fn(() => true),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
			captureException: vi.fn(),
		},
	},
}))

// Make legacy gate pass (Day 3 policy gate is in preExecutionHook).
vi.mock("../../intents/activeIntent", () => ({
	hasActiveIntentSelected: vi.fn().mockResolvedValue(true),
}))

// Mock tool handlers so we can assert they're NOT called.
vi.mock("../../tools/ExecuteCommandTool", () => ({
	executeCommandTool: { handle: vi.fn() },
}))

vi.mock("../../tools/WriteToFileTool", () => ({
	writeToFileTool: { handle: vi.fn() },
}))

// Provide minimal mocks for any tools referenced by presentAssistantMessage switch.
vi.mock("../../tools/ReadFileTool", () => ({
	readFileTool: { handle: vi.fn(), getReadFileToolDescription: () => "[read_file]" },
}))
vi.mock("../../tools/ListFilesTool", () => ({ listFilesTool: { handle: vi.fn() } }))
vi.mock("../../tools/ReadCommandOutputTool", () => ({ readCommandOutputTool: { handle: vi.fn() } }))
vi.mock("../../tools/EditTool", () => ({ editTool: { handle: vi.fn() } }))
vi.mock("../../tools/SearchReplaceTool", () => ({ searchReplaceTool: { handle: vi.fn() } }))
vi.mock("../../tools/EditFileTool", () => ({ editFileTool: { handle: vi.fn() } }))
vi.mock("../../tools/ApplyPatchTool", () => ({ applyPatchTool: { handle: vi.fn() } }))
vi.mock("../../tools/SearchFilesTool", () => ({ searchFilesTool: { handle: vi.fn() } }))
vi.mock("../../tools/UseMcpToolTool", () => ({ useMcpToolTool: { handle: vi.fn() } }))
vi.mock("../../tools/accessMcpResourceTool", () => ({ accessMcpResourceTool: { handle: vi.fn() } }))
vi.mock("../../tools/AskFollowupQuestionTool", () => ({ askFollowupQuestionTool: { handle: vi.fn() } }))
vi.mock("../../tools/SwitchModeTool", () => ({ switchModeTool: { handle: vi.fn() } }))
vi.mock("../../tools/AttemptCompletionTool", () => ({ attemptCompletionTool: { handle: vi.fn() } }))
vi.mock("../../tools/NewTaskTool", () => ({ newTaskTool: { handle: vi.fn() } }))
vi.mock("../../tools/UpdateTodoListTool", () => ({ updateTodoListTool: { handle: vi.fn() } }))
vi.mock("../../tools/RunSlashCommandTool", () => ({ runSlashCommandTool: { handle: vi.fn() } }))
vi.mock("../../tools/SkillTool", () => ({ skillTool: { handle: vi.fn() } }))
vi.mock("../../tools/GenerateImageTool", () => ({ generateImageTool: { handle: vi.fn() } }))
vi.mock("../../tools/ApplyDiffTool", () => ({ applyDiffTool: { handle: vi.fn() } }))
vi.mock("../../tools/CodebaseSearchTool", () => ({ codebaseSearchTool: { handle: vi.fn() } }))

// Minimal Task mock shape used by presentAssistantMessage
const createMockTask = (cwd: string) => {
	return {
		cwd,
		taskId: "task_123",
		instanceId: "i1",
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
		toolRepetitionDetector: { check: vi.fn().mockReturnValue({ allowExecution: true }) },
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

async function writeActiveIntentYaml(cwd: string) {
	const orch = path.join(cwd, ".orchestration")
	await fs.mkdir(orch, { recursive: true })

	const yaml = [
		"active_intent_id: INT-TEST",
		"intents:",
		"  - id: INT-TEST",
		"    title: Test Intent",
		"    scope:",
		"      paths:",
		"        - allowed/**",
	].join("\n")

	await fs.writeFile(path.join(orch, "active_intents.yaml"), yaml, "utf-8")
}

describe("presentAssistantMessage Day 3 guardrails", () => {
	let cwd: string
	let task: any

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "roo-day3-"))
		await writeActiveIntentYaml(cwd)
		task = createMockTask(cwd)
		vi.mocked(executeCommandTool.handle).mockClear()
		vi.mocked(writeToFileTool.handle).mockClear()
		vi.restoreAllMocks()
	})

	it("blocks destructive execute_command when user rejects (preExecutionHook integration)", async () => {
		vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue("Reject" as any)

		task.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_1",
				name: "execute_command",
				params: { command: "rm -rf /" },
				nativeArgs: { command: "rm -rf /" },
				partial: false,
			},
		]

		await presentAssistantMessage(task)

		expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1)
		expect(executeCommandTool.handle).not.toHaveBeenCalled()

		expect(task.pushToolResultToUserContent).toHaveBeenCalledTimes(1)
		const pushed = task.pushToolResultToUserContent.mock.calls[0][0]
		expect(pushed).toMatchObject({ type: "tool_result", tool_use_id: "tool_call_1", is_error: true })
		expect(String(pushed.content)).toContain("Destructive command rejected")
	})

	it("blocks out-of-scope write_to_file before tool executes (preExecutionHook integration)", async () => {
		task.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_2",
				name: "write_to_file",
				params: { path: "not-allowed/file.txt", content: "hi" },
				nativeArgs: { path: "not-allowed/file.txt", content: "hi" },
				partial: false,
			},
		]

		await presentAssistantMessage(task)

		expect(writeToFileTool.handle).not.toHaveBeenCalled()
		expect(task.pushToolResultToUserContent).toHaveBeenCalledTimes(1)
		const pushed = task.pushToolResultToUserContent.mock.calls[0][0]
		expect(pushed).toMatchObject({ type: "tool_result", tool_use_id: "tool_call_2", is_error: true })
		expect(String(pushed.content)).toContain("Out-of-scope write blocked")
	})
})
