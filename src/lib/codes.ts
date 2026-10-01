export const LEVELS = ["1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B"] as const;

export function levelIndex(level: string): number {
  return LEVELS.indexOf(level.toUpperCase() as (typeof LEVELS)[number]);
}

export function nextLevel(level: string): string {
  const i = levelIndex(level);
  return LEVELS[Math.min(i + 1, LEVELS.length - 1)] ?? "1A";
}

/** "ECE 457B" / "ece457b" -> "ECE457B" */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "");
}

/** "ECE457B" -> "ECE 457B" */
export function formatCode(code: string): string {
  return code.replace(/^([A-Z]+)(\d)/, "$1 $2");
}

const CODE_RE = /\b([A-Za-z]{2,7})\s?(\d{1,3}[A-Za-z]{0,2})\b/g;

/** Pulls course codes out of arbitrary pasted text (lists, Quest output, etc.). */
export function extractCodes(text: string, known?: (code: string) => boolean): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(CODE_RE)) {
    const code = normalizeCode(m[1] + m[2]);
    if (!known || known(code)) out.add(code);
  }
  return [...out];
}
