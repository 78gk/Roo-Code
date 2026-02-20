import { createHash } from "crypto"

/**
 * Deterministic SHA-256 hash for spatially-independent trace attribution.
 *
 * Normalization rules:
 * - Convert CRLF -> LF
 * - Do not trim or otherwise rewrite content
 */
export function sha256Hash(content: string): string {
	const normalized = content.replace(/\r\n/g, "\n")
	const hash = createHash("sha256").update(normalized, "utf8").digest("hex")
	return `sha256:${hash}`
}
