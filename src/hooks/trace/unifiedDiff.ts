export type UnifiedDiffExtractResult = {
	/** Concatenation of all added lines across hunks (excluding diff metadata) */
	addedText: string
	/** True if at least one added line was found */
	hasAddedLines: boolean
}

/**
 * Extract a deterministic "post-patch content block" from a unified diff.
 *
 * Strategy:
 * - Parse all hunks and concatenate all added lines (lines starting with '+')
 * - Ignore diff headers (---/+++), hunk headers (@@), and file markers
 * - Preserve exact text (minus the leading '+') and preserve line boundaries
 */
export function extractAddedBlockFromUnifiedDiff(diff: string): UnifiedDiffExtractResult {
	const normalized = diff.replace(/\r\n/g, "\n")
	const lines = normalized.split("\n")

	let inHunk = false
	const added: string[] = []

	for (const line of lines) {
		if (line.startsWith("@@")) {
			inHunk = true
			continue
		}

		if (!inHunk) continue

		// Unified diff hunks use: ' ' context, '-' deletions, '+' additions.
		if (line.startsWith("+++")) continue
		if (line.startsWith("---")) continue

		if (line.startsWith("+")) {
			// Exclude "+++" already handled.
			added.push(line.slice(1))
		}
	}

	return {
		addedText: added.length > 0 ? added.join("\n") + "\n" : "",
		hasAddedLines: added.length > 0,
	}
}
