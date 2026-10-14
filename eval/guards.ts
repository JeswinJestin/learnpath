export function surfaceGuard(
  changedFiles: string[],
  allowed: string[] = ["lib/learnpath.ts"],
): { ok: boolean; offending: string[] } {
  const offending = changedFiles.filter((f) => f.trim() !== "" && !allowed.includes(f.trim()));
  return { ok: offending.length === 0, offending };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function noSpecialCasingLint(
  addedLines: string[],
  forbidden: string[],
): { ok: boolean; hits: string[] } {
  const hits = new Set<string>();
  for (const tok of forbidden) {
    if (!tok) continue;
    const re = new RegExp(`["'\`]${escapeRegExp(tok)}["'\`]`, "i");
    for (const line of addedLines) {
      if (re.test(line)) hits.add(tok.toLowerCase());
    }
  }
  return { ok: hits.size === 0, hits: [...hits] };
}
