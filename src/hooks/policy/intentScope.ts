import * as path from "path"

import { isGlobMatch, normalizeToPosixPath } from "./globMatch"

export type ScopeCheckInput = {
	cwd: string
	relPath: string
	scopeGlobs: string[]
}

export function isPathWithinScope({ cwd, relPath, scopeGlobs }: ScopeCheckInput): boolean {
	const candidateAbs = path.resolve(cwd, relPath)
	const candidateRel = normalizeToPosixPath(path.relative(cwd, candidateAbs))

	return scopeGlobs.some((glob) => {
		const normalizedGlob = normalizeToPosixPath(glob).replace(/^\.?\//, "")
		return isGlobMatch(normalizedGlob, candidateRel)
	})
}
