export type CommandRisk = "safe" | "destructive"

const DESTRUCTIVE_PATTERNS: RegExp[] = [
	// recursive deletes
	/\brm\s+-rf\b/i,
	/\brm\s+-r\b/i,
	/\brmdir\b/i,
	/\bdel\b/i,
	/\bRemove-Item\b/i,
	// disk/partition
	/\bmkfs\b/i,
	/\bdd\b/i,
	// git destructive
	/\bgit\s+reset\s+--hard\b/i,
	/\bgit\s+clean\s+-f/i,
	/\bgit\s+push\s+--force\b/i,
	// package manager installs/uninstalls can change state significantly
	/\bnpm\s+(i|install|uninstall)\b/i,
	/\bpnpm\s+(i|install|add|remove|uninstall)\b/i,
	/\byarn\s+(add|remove)\b/i,
	// shell piping into sh
	/\bcurl\b[^\n]*\|\s*(sh|bash)\b/i,
	/\bwget\b[^\n]*\|\s*(sh|bash)\b/i,
]

const SAFE_ALLOWLIST: RegExp[] = [
	/^\s*git\s+(status|diff|log|show|rev-parse|ls-files|grep)\b/i,
	/^\s*node\s+--version\b/i,
	/^\s*(npm|pnpm|yarn)\s+(--version|-v)\b/i,
	/^\s*ls\b/i,
	/^\s*dir\b/i,
	/^\s*cat\b/i,
	/^\s*type\b/i,
]

export function classifyCommandRisk(command: string): CommandRisk {
	const c = command.trim()
	if (!c) return "safe"
	if (SAFE_ALLOWLIST.some((re) => re.test(c))) return "safe"
	if (DESTRUCTIVE_PATTERNS.some((re) => re.test(c))) return "destructive"

	// Heuristic: multiple commands chained with && or ; are higher risk
	if (/[;&]{1,2}/.test(c)) return "destructive"
	return "safe"
}
