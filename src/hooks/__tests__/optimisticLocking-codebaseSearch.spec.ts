import { beforeEach, describe, expect, it, vi } from "vitest"

import * as fs from "fs/promises"

import { preExecutionHook } from "../pre-execution"
import { postToolHook } from "../postToolHook"
import { readHashStore } from "../locking/readHashStore"

vi.mock("vscode", async () => await import("../../__mocks__/vscode.js"))
vi.mock("../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(async () => true),
	createDirectoriesForFile: vi.fn(async () => {}),
}))

vi.mock("fs/promises", () => ({
	readFile: vi.fn(async () => ""),
	writeFile: vi.fn(async () => {}),
	appendFile: vi.fn(async () => {}),
}))

const ACTIVE_YAML = `active_intent_id: intent_1
intents:
  - id: intent_1
    title: Test
    scope:
      paths:
        - src/**
`

describe("optimistic locking: codebase_search snapshot source", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		readHashStore.clearTask("task_1")
		vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
			const s = String(p)
			if (s.includes(".orchestration") && s.includes("active_intents.yaml")) return ACTIVE_YAML
			// any file content we read is 'A\n'
			return "A\n"
		})
	})

	it("allows write after codebase_search recorded a snapshot (no read_file needed)", async () => {
		await postToolHook({
			cwd: "/repo",
			taskId: "task_1",
			modelId: "test-model",
			toolName: "codebase_search",
			toolArgs: { query: "x", path: null },
			toolResult: "Query: x\nResults:\n\nFile path: src/index.ts\nScore: 0.9\nLines: 1-2\nCode Chunk: hi\n",
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

		expect(result).toEqual({ kind: "continue" })
	})

	it("does not record snapshots when codebase_search output has no file paths", async () => {
		await postToolHook({
			cwd: "/repo",
			taskId: "task_1",
			modelId: "test-model",
			toolName: "codebase_search",
			toolArgs: { query: "x", path: null },
			toolResult: "No relevant code snippets found for the query",
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
			expect(result.toolResult).toContain("No read snapshot recorded")
		}
	})
})
