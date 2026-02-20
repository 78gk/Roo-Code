// npx vitest src/hooks/__tests__/agentTrace.day4.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(async () => true),
	createDirectoriesForFile: vi.fn(async () => {}),
}))

vi.mock("fs/promises", () => ({
	readFile: vi.fn(async () => ""),
	appendFile: vi.fn(async () => {}),
}))

vi.mock("child_process", () => ({
	execFile: (cmd: string, args: string[], opts: any, cb: (err: any, stdout?: string) => void) => {
		// Default: no git
		cb(new Error("no git"))
	},
}))

import * as fs from "fs/promises"

import { sha256Hash } from "../../utils/hash"
import { appendAgentTraceEntry } from "../trace/agentTrace"

describe("Agent Trace Day 4", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("sha256Hash normalizes CRLF to LF and prefixes with sha256:", () => {
		const a = sha256Hash("a\r\nb")
		const b = sha256Hash("a\nb")
		expect(a).toBe(b)
		expect(a.startsWith("sha256:")).toBe(true)
	})

	it("appendAgentTraceEntry appends JSONL line with intent id and content_hash", async () => {
		vi.mocked(fs.readFile).mockResolvedValue(
			`active_intent_id: intent_1\nintents:\n  - id: intent_1\n    title: Test\n`,
		)

		await appendAgentTraceEntry({
			cwd: "/repo",
			taskId: "task_123",
			modelId: "test-model",
			toolName: "write_to_file",
			toolArgs: {
				intent_id: "intent_1",
				mutation_class: "AST_REFACTOR",
				path: "src/index.ts",
				content: "console.log('x')\n",
			},
			toolResult: "ok",
		})

		expect(fs.appendFile).toHaveBeenCalledTimes(1)
		const [filePath, line] = vi.mocked(fs.appendFile).mock.calls[0]
		expect(String(filePath)).toContain(".orchestration")
		expect(String(filePath)).toContain("agent_trace.jsonl")

		const parsed = JSON.parse(String(line).trim())
		expect(parsed.schema_version).toBe("1.0")
		expect(parsed.event_type).toBe("tool_write")
		expect(parsed.files[0].relative_path).toBe("src/index.ts")
		expect(parsed.files[0].conversations[0].related[0].value).toBe("intent_1")
		expect(parsed.files[0].conversations[0].mutation_class).toBe("AST_REFACTOR")
		expect(parsed.files[0].conversations[0].url).toBe("task_123")
		expect(parsed.files[0].conversations[0].contributor.model_identifier).toBe("test-model")
		expect(parsed.files[0].conversations[0].ranges[0].content_hash).toBe(sha256Hash("console.log('x')\n"))
	})

	it("hashes apply_diff using concatenated added lines across hunks", async () => {
		vi.mocked(fs.readFile).mockResolvedValue(
			`active_intent_id: intent_1\nintents:\n  - id: intent_1\n    title: Test\n`,
		)

		const diff = [
			"--- a/src/a.ts",
			"+++ b/src/a.ts",
			"@@ -1,1 +1,3 @@",
			" console.log('a')",
			"+console.log('b')",
			"+console.log('c')",
			"",
		].join("\n")

		await appendAgentTraceEntry({
			cwd: "/repo",
			taskId: "task_123",
			modelId: "test-model",
			toolName: "apply_diff",
			toolArgs: {
				intent_id: "intent_1",
				mutation_class: "INTENT_EVOLUTION",
				path: "src/a.ts",
				diff,
			},
			toolResult: "ok",
		})

		expect(fs.appendFile).toHaveBeenCalledTimes(1)
		const [, line] = vi.mocked(fs.appendFile).mock.calls[0]
		const parsed = JSON.parse(String(line).trim())

		const expectedAddedBlock = "console.log('b')\nconsole.log('c')\n"
		expect(parsed.files[0].conversations[0].ranges[0].content_hash).toBe(sha256Hash(expectedAddedBlock))
	})

	it("falls back to hashing final file content when apply_diff has no added lines", async () => {
		vi.mocked(fs.readFile)
			.mockResolvedValueOnce(`active_intent_id: intent_1\nintents:\n  - id: intent_1\n    title: Test\n`)
			.mockResolvedValueOnce("final file\n")

		const diff = [
			"--- a/src/a.ts",
			"+++ b/src/a.ts",
			"@@ -1,2 +1,1 @@",
			"-console.log('remove')",
			" console.log('keep')",
			"",
		].join("\n")

		await appendAgentTraceEntry({
			cwd: "/repo",
			taskId: "task_123",
			modelId: "test-model",
			toolName: "apply_diff",
			toolArgs: {
				intent_id: "intent_1",
				mutation_class: "AST_REFACTOR",
				path: "src/a.ts",
				diff,
			},
			toolResult: "ok",
		})

		expect(fs.appendFile).toHaveBeenCalledTimes(1)
		const [, line] = vi.mocked(fs.appendFile).mock.calls[0]
		const parsed = JSON.parse(String(line).trim())
		expect(parsed.files[0].conversations[0].ranges[0].content_hash).toBe(sha256Hash("final file\n"))
	})

	it("appendAgentTraceEntry is a no-op when no active intent is selected", async () => {
		vi.mocked(fs.readFile).mockResolvedValue(`active_intent_id: null\nintents: []\n`)

		await appendAgentTraceEntry({
			cwd: "/repo",
			taskId: "task_123",
			modelId: "test-model",
			toolName: "write_to_file",
			toolArgs: { intent_id: "intent_1", mutation_class: "AST_REFACTOR", path: "src/index.ts", content: "x" },
			toolResult: "ok",
		})

		expect(fs.appendFile).not.toHaveBeenCalled()
	})
})
