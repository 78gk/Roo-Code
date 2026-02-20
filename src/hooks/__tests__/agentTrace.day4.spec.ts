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
		expect(parsed.files[0].conversations[0].ranges[0].content_hash).toBe(sha256Hash("console.log('x')\n"))
	})

	it("appendAgentTraceEntry is a no-op when no active intent is selected", async () => {
		vi.mocked(fs.readFile).mockResolvedValue(`active_intent_id: null\nintents: []\n`)

		await appendAgentTraceEntry({
			cwd: "/repo",
			toolName: "write_to_file",
			toolArgs: { intent_id: "intent_1", mutation_class: "AST_REFACTOR", path: "src/index.ts", content: "x" },
			toolResult: "ok",
		})

		expect(fs.appendFile).not.toHaveBeenCalled()
	})
})
