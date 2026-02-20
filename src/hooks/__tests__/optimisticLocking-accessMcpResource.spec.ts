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

describe("optimistic locking: access_mcp_resource snapshot source", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		readHashStore.clearTask("task_1")
		vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
			const s = String(p)
			if (s.includes(".orchestration") && s.includes("active_intents.yaml")) return ACTIVE_YAML
			return "A\n"
		})
	})

	it("allows write after access_mcp_resource recorded a snapshot from file:// uri", async () => {
		await postToolHook({
			cwd: "/repo",
			taskId: "task_1",
			modelId: "test-model",
			toolName: "access_mcp_resource",
			toolArgs: { server_name: "fs", uri: "file:///repo/src/index.ts" },
			toolResult: "(resource contents)",
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

	it("does not record snapshots for non-file URIs", async () => {
		await postToolHook({
			cwd: "/repo",
			taskId: "task_1",
			modelId: "test-model",
			toolName: "access_mcp_resource",
			toolArgs: { server_name: "fs", uri: "weather://x" },
			toolResult: "(resource contents)",
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
