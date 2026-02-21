import { describe, expect, it, vi, beforeEach } from "vitest"

import { preExecutionHook } from "../pre-execution"
import { readHashStore } from "../locking/readHashStore"

// Mock fs + vscode the same way as other hook tests.
vi.mock("fs/promises", () => ({
	readFile: vi.fn(async () => ""),
	writeFile: vi.fn(async () => {}),
}))

vi.mock("../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(async () => true),
	createDirectoriesForFile: vi.fn(async () => {}),
}))

vi.mock("vscode", async () => await import("../../__mocks__/vscode.js"))

const readFileMock = vi.mocked(await import("fs/promises")).readFile

const ACTIVE_YAML = `active_intent_id: intent_1
intents:
  - id: intent_1
    title: Test
    scope:
      paths:
        - src/**
`

describe("preExecutionHook Day 5 optimistic locking", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		readHashStore.clearTask("task_1")
		readFileMock.mockImplementation(async (p: any) => {
			// Active intents file
			if (String(p).includes(".orchestration") && String(p).includes("active_intents.yaml")) return ACTIVE_YAML
			// Default file content
			return "A\n"
		})
	})

	it("blocks write if file changed since last read", async () => {
		// 1) read_file captures hash of "A\n"
		await preExecutionHook({
			cwd: "/repo",
			taskId: "task_1",
			toolName: "read_file",
			toolArgs: { path: "src/index.ts" },
		})

		// 2) file changed to "B\n"
		readFileMock.mockImplementation(async (p: any) => {
			if (String(p).includes(".orchestration") && String(p).includes("active_intents.yaml")) return ACTIVE_YAML
			return "B\n"
		})

		const result = await preExecutionHook({
			cwd: "/repo",
			taskId: "task_1",
			toolName: "write_to_file",
			toolArgs: {
				intent_id: "intent_1",
				mutation_class: "AST_REFACTOR",
				path: "src/index.ts",
				content: "new",
			},
		})

		expect(result.kind).toBe("blocked")
		if (result.kind === "blocked") {
			expect(result.toolResult).toContain("Error: Stale File")
		}
	})

	it("blocks write if no read snapshot exists", async () => {
		const result = await preExecutionHook({
			cwd: "/repo",
			taskId: "task_1",
			toolName: "write_to_file",
			toolArgs: {
				intent_id: "intent_1",
				mutation_class: "AST_REFACTOR",
				path: "src/index.ts",
				content: "new",
			},
		})

		expect(result.kind).toBe("blocked")
		if (result.kind === "blocked") {
			expect(result.toolResult).toContain("No read snapshot recorded")
		}
	})
})
