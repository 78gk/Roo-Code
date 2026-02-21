Set-Location (Split-Path -Parent $PSScriptRoot)

$outputPath = Join-Path (Get-Location) "FINAL_REPORT.pdf"
$lines = @(
  "TRP1 Challenge Week 1 - Final Submission Report",
  "Date: 2026-02-21",
  "Branch: feature/intent-handshake",
  "Commit: b4e5c9b87085362e9cc33b726c8b22416840b247",
  "",
  "Implemented:",
  "- Intent handshake + mandatory select_active_intent",
  "- Deterministic PreToolUse/PostToolUse hooks",
  "- Scope enforcement for writes",
  "- HITL approval for destructive commands",
  "- Agent trace JSONL with SHA-256 content hashes",
  "- Optimistic locking / stale write rejection",
  "",
  "Artifacts:",
  "- .orchestration/active_intents.yaml",
  "- .orchestration/agent_trace.jsonl",
  "- .orchestration/intent_map.md",
  "- CLAUDE.md",
  "- FINAL_PROOF_WORKFLOW.md",
  "- report-assets/final-proof-test-output-v2.txt",
  "",
  "Proof: 7 test files passed, 23 tests passed.",
  "See FINAL_REPORT.md for full details."
)

$content = "BT`n/F1 11 Tf`n50 790 Td`n"
foreach ($line in $lines) {
  $escaped = $line.Replace("\", "\\").Replace("(", "\(").Replace(")", "\)")
  $content += "($escaped) Tj`n0 -14 Td`n"
}
$content += "ET`n"

$objects = @()
$objects += "1 0 obj`n<< /Type /Catalog /Pages 2 0 R >>`nendobj`n"
$objects += "2 0 obj`n<< /Type /Pages /Kids [3 0 R] /Count 1 >>`nendobj`n"
$objects += "3 0 obj`n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`nendobj`n"
$objects += "4 0 obj`n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`nendobj`n"
$length = [System.Text.Encoding]::ASCII.GetByteCount($content)
$objects += "5 0 obj`n<< /Length $length >>`nstream`n$content`nendstream`nendobj`n"

$pdf = "%PDF-1.4`n"
$offsets = @(0)
foreach ($obj in $objects) {
  $offsets += [System.Text.Encoding]::ASCII.GetByteCount($pdf)
  $pdf += $obj
}

$xrefStart = [System.Text.Encoding]::ASCII.GetByteCount($pdf)
$xref = "xref`n0 6`n0000000000 65535 f `n"
for ($i = 1; $i -le 5; $i++) {
  $xref += ('{0:D10} 00000 n `n' -f $offsets[$i])
}
$trailer = "trailer`n<< /Size 6 /Root 1 0 R >>`nstartxref`n$xrefStart`n%%EOF`n"
$pdf += $xref + $trailer

[System.IO.File]::WriteAllBytes($outputPath, [System.Text.Encoding]::ASCII.GetBytes($pdf))
Get-Item $outputPath | Select-Object FullName, Length | Format-Table -AutoSize
