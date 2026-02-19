import { beforeEach, describe, expect, it, vi } from "vitest"

import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

vi.mock("vscode", async () => await import("../../../__mocks__/vscode.js"))
import * as vscode from "vscode"

// avoid pulling real Task
vi.mock("../../task/Task")

vi.mock("../../tools/validateToolUse", () => ({ validateToolUse: vi.fn(), isValidToolName: vi.fn(() => true) }))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: { captureToolUsage: vi.fn(), captureConsecutiveMistakeError: vi.fn(), captureException: vi.fn() },
	},
}))
vi.mock("../../intents/activeIntent", () => ({ hasActiveIntentSelected: vi.fn().mockResolvedValue(true) }))

vi.mock("../../tools/ExecuteCommandTool", () => ({ executeCommandTool: { handle: vi.fn() } }))
vi.mock("../../tools/WriteToFileTool", () => ({ writeToFileTool: { handle: vi.fn() } }))
vi.mock("../../tools/ReadFileTool", () => ({
	readFileTool: { handle: vi.fn(), getReadFileToolDescription: () => "[read_file]" },
}))

// minimal mocks for switch imports
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

import { presentAssistantMessage } from "../presentAssistantMessage"
import { executeCommandTool } from "../../tools/ExecuteCommandTool"
import { writeToFileTool } from "../../tools/WriteToFileTool"
import { readFileTool } from "../../tools/ReadFileTool"

const createMockTask = (cwd: string) =>
	({
		cwd,
		taskId: "t1",
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
		taskName: "mock",
		recordToolUsage: vi.fn(),
		recordToolError: vi.fn(),
		pushToolResultToUserContent: vi.fn(),
		say: vi.fn(),
		task: vi.fn(),
		checkpointSave: vi.fn(),
		currentStreamingDidCheckpoint: false,
	}) as any

async function writeActiveIntentYaml(cwd: string) {
	const orch = path.join(cwd, ".orchestration")
	await fs.mkdir(orch, { recursive: true })
	await fs.writeFile(
		path.join(orch, "active_intents.yaml"),
		[
			"active_intent_id: INT-TEST",
			"intents:",
			"  - id: INT-TEST",
			"    scope:",
			"      paths:",
			"        - allowed/**",
		].join("\n"),
		"utf-8",
	)
}

describe("presentAssistantMessage Day 3 guardrails", () => {
	let cwd: string
	let task: any

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "roo-day3-"))
		await writeActiveIntentYaml(cwd)
		task = createMockTask(cwd)
		vi.clearAllMocks()
		vi.mocked(executeCommandTool.handle).mockClear()
		vi.mocked(writeToFileTool.handle).mockClear()
		vi.mocked(readFileTool.handle).mockClear()
	})

	it("blocks destructive execute_command when user rejects", async () => {
		vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue("Reject" as any)
		task.assistantMessageContent = [
			{
				type: "tool_use",
				id: "c1",
				name: "execute_command",
				params: { command: "rm -rf /" },
				nativeArgs: { command: "rm -rf /" },
				partial: false,
			},
		]
		await presentAssistantMessage(task)
		expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1)
		expect(executeCommandTool.handle).not.toHaveBeenCalled()
	})

	it("allows safe execute_command without prompting", async () => {
		const spy = vi.spyOn(vscode.window, "showWarningMessage")
		task.assistantMessageContent = [
			{
				type: "tool_use",
				id: "c2",
				name: "execute_command",
				params: { command: "echo hi" },
				nativeArgs: { command: "echo hi" },
				partial: false,
			},
		]
		await presentAssistantMessage(task)
		expect(spy).not.toHaveBeenCalled()
		expect(executeCommandTool.handle).toHaveBeenCalledTimes(1)
	})

	it("blocks out-of-scope write_to_file before tool executes", async () => {
		task.assistantMessageContent = [
			{
				type: "tool_use",
				id: "w1",
				name: "write_to_file",
				params: { path: "not-allowed/a.txt", content: "x" },
				nativeArgs: { path: "not-allowed/a.txt", content: "x" },
				partial: false,
			},
		]
		await presentAssistantMessage(task)
		expect(writeToFileTool.handle).not.toHaveBeenCalled()
	})

	it("allows read_file regardless of scope", async () => {
		task.assistantMessageContent = [
			{
				type: "tool_use",
				id: "r1",
				name: "read_file",
				params: { path: "not-allowed/a.txt" },
				nativeArgs: { path: "not-allowed/a.txt" },
				partial: false,
			},
		]
		await presentAssistantMessage(task)
		expect(readFileTool.handle).toHaveBeenCalledTimes(1)
	})
})
