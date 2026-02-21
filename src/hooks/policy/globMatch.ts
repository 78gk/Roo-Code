export function normalizeToPosixPath(p: string): string {
	return p.replace(/\\/g, "/")
}

function escapeRegexChar(ch: string): string {
	return /[\\^$.*+?()[\]{}|]/.test(ch) ? `\\${ch}` : ch
}

/**
 * Minimal glob matcher supporting the patterns we use in intent scope paths:
 * - `*` matches any chars except `/`
 * - `**` matches any chars including `/`
 * - `?` matches a single char except `/`
 *
 * Anchored match (whole string).
 */
export function isGlobMatch(globPattern: string, candidatePath: string): boolean {
	const pattern = normalizeToPosixPath(globPattern)
		.trim()
		.replace(/^\.?\//, "")
	const candidate = normalizeToPosixPath(candidatePath).replace(/^\.?\//, "")
	if (!pattern) return false

	let re = "^"
	for (let i = 0; i < pattern.length; i++) {
		const ch = pattern[i]
		if (ch === "*") {
			const next = pattern[i + 1]
			if (next === "*") {
				// `**`
				re += ".*"
				i++
			} else {
				// `*`
				re += "[^/]*"
			}
			continue
		}

		if (ch === "?") {
			re += "[^/]"
			continue
		}

		re += escapeRegexChar(ch)
	}
	re += "$"

	return new RegExp(re).test(candidate)
}
