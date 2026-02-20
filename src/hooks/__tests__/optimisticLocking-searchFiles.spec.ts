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

describe("optimistic locking: search_files snapshot source", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		readHashStore.clearTask("task_1")
		vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
			const s = String(p)
			if (s.includes(".orchestration") && s.includes("active_intents.yaml")) return ACTIVE_YAML
			return "A\n"
		})
	})

	it("allows write after search_files recorded a snapshot", async () => {
		await postToolHook({
			cwd: "/repo",
			taskId: "task_1",
			modelId: "test-model",
			toolName: "search_files",
			toolArgs: { path: "src", regex: "x", file_pattern: null },
			toolResult: "Found 1 result.\n\n# src/index.ts\n  1 | x\n----\n",
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

	it("does not record snapshots when search_files output has no file headers", async () => {
		await postToolHook({
			cwd: "/repo",
			taskId: "task_1",
			modelId: "test-model",
			toolName: "search_files",
			toolArgs: { path: "src", regex: "x", file_pattern: null },
			toolResult: "No results found",
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
