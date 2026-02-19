// npx vitest src/hooks/__tests__/preExecutionHook.day3.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("vscode", async () => await import("../../__mocks__/vscode.js"))

import * as vscode from "vscode"

vi.mock("../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(async () => true),
	createDirectoriesForFile: vi.fn(async () => {}),
}))

vi.mock("fs/promises", () => ({
	readFile: vi.fn(async () => ""),
	writeFile: vi.fn(async () => {}),
}))

import * as fs from "fs/promises"

import { preExecutionHook } from "../pre-execution"

const mockActiveIntentsYaml = (yamlText: string) => {
	vi.mocked(fs.readFile).mockResolvedValue(yamlText)
}

describe("preExecutionHook Day 3 guardrails", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("blocks write tool when path is outside active intent scope", async () => {
		mockActiveIntentsYaml(
			`active_intent_id: intent_1\nintents:\n  - id: intent_1\n    title: Test\n    scope:\n      paths:\n        - src/**\n`,
		)

		const result = await preExecutionHook({
			cwd: "/repo",
			toolName: "write_to_file",
			toolArgs: { path: "README.md", content: "x" },
		})

		expect(result.kind).toBe("blocked")
		expect(result.toolResult).toContain("Out-of-scope write blocked")
	})

	it("allows write tool when path is within active intent scope", async () => {
		mockActiveIntentsYaml(
			`active_intent_id: intent_1\nintents:\n  - id: intent_1\n    title: Test\n    scope:\n      paths:\n        - src/**\n`,
		)

		const result = await preExecutionHook({
			cwd: "/repo",
			toolName: "write_to_file",
			toolArgs: { path: "src/index.ts", content: "x" },
		})

		expect(result).toEqual({ kind: "continue" })
	})

	it("prompts for approval on destructive execute_command; reject blocks execution", async () => {
		vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue("Reject" as any)
		mockActiveIntentsYaml(
			`active_intent_id: intent_1\nintents:\n  - id: intent_1\n    title: Test\n    scope:\n      paths:\n        - src/**\n`,
		)

		const result = await preExecutionHook({
			cwd: "/repo",
			toolName: "execute_command",
			toolArgs: { command: "rm -rf /" },
		})

		expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1)
		expect(result.kind).toBe("blocked")
		expect(result.toolResult).toContain("rejected")
	})

	it("prompts for approval on destructive execute_command; approve continues", async () => {
		vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue("Approve" as any)
		mockActiveIntentsYaml(
			`active_intent_id: intent_1\nintents:\n  - id: intent_1\n    title: Test\n    scope:\n      paths:\n        - src/**\n`,
		)

		const result = await preExecutionHook({
			cwd: "/repo",
			toolName: "execute_command",
			toolArgs: { command: "rm -rf dist" },
		})

		expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1)
		expect(result).toEqual({ kind: "continue" })
	})

	it("does not prompt for approval on safe execute_command", async () => {
		mockActiveIntentsYaml(
			`active_intent_id: intent_1\nintents:\n  - id: intent_1\n    title: Test\n    scope:\n      paths:\n        - src/**\n`,
		)

		const result = await preExecutionHook({
			cwd: "/repo",
			toolName: "execute_command",
			toolArgs: { command: "git status" },
		})

		expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
		expect(result).toEqual({ kind: "continue" })
	})
})
