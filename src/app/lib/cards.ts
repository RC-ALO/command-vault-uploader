import 'server-only';

export type CardKind = 'CodexCard' | 'CompletionCard' | 'Unknown';

export interface ParsedCard {
  kind: CardKind;
  loop?: string;
  taskRef?: string;
  dateIssued?: string;
  dateCompleted?: string;
  filingLocation?: string;
}

/**
 * Heuristic detector:
 *  1) Prefer explicit headers '# 🗂️ CodexCard' / '# 🗂️ CompletionCard'
 *  2) Fall back to required-field presence from templates:
 *     - CodexCard: Loop Number + Task Reference + Date Issued
 *     - CompletionCard: Completed Task + Loop Number + Task Reference + Date Completed:contentReference[oaicite:4]{index=4}
 */
export function detectCardKindFromContent(text: string): CardKind {
  // Header (forgiving of whitespace/case)
  if (/^#\s*🗂️?\s*CodexCard\b/im.test(text)) return 'CodexCard';
  if (/^#\s*🗂️?\s*CompletionCard\b/im.test(text)) return 'CompletionCard';

  const hasLoop = /(^|\n)\s*.*?Loop\s*Number\s*:\s*.+/i.test(text);
  const hasTaskRef = /(^|\n)\s*.*?Task\s*Reference\s*:\s*.+/i.test(text);
  const hasIssued = /(^|\n)\s*.*?Date\s*Issued\s*:\s*.+/i.test(text);

  const hasCompletedTask = /(^|\n)\s*.*?Completed\s*Task\s*:\s*.+/i.test(text);
  const hasDateCompleted = /(^|\n)\s*.*?Date\s*Completed\s*:\s*.+/i.test(text);

  if (hasLoop && hasTaskRef && hasIssued) return 'CodexCard';
  if (hasCompletedTask && hasLoop && hasTaskRef && hasDateCompleted) return 'CompletionCard';
  return 'Unknown';
}

// helper to trim brackets/backticks and excess spaces
const clean = (v?: string) => (v || '').replace(/^`?\[?|\]?`?$/g, '').trim();

/**
 * Robust parser tolerant of emojis, bold, and whitespace.
 * Extracts Loop Number, Task Reference, dates, and Filing Location.
 */
export function parseCard(text: string): ParsedCard {
  const kind = detectCardKindFromContent(text);
  const out: ParsedCard = { kind };

  // 🔄 Loop Number
  const loopLine = text.match(/^[^\S\r\n]*.*?\bLoop\s*Number\s*:\s*([^\r\n]+)/gmi);
  if (loopLine?.[0]) out.loop = clean(loopLine[0].replace(/^.*?:\s*/, ''));

  // 🆔 Task Reference
  const refLine = text.match(/^[^\S\r\n]*.*?\bTask\s*Reference\s*:\s*([^\r\n]+)/gmi);
  if (refLine?.[0]) out.taskRef = clean(refLine[0].replace(/^.*?:\s*/, ''));

  // 📅 Date Issued (CodexCard)
  const issuedLine = text.match(/^[^\S\r\n]*.*?\bDate\s*Issued\s*:\s*([^\r\n]+)/gmi);
  if (issuedLine?.[0]) out.dateIssued = clean(issuedLine[0].replace(/^.*?:\s*/, ''));

  // 📅 Date Completed (CompletionCard)
  const completedLine = text.match(/^[^\S\r\n]*.*?\bDate\s*Completed\s*:\s*([^\r\n]+)/gmi);
  if (completedLine?.[0]) out.dateCompleted = clean(completedLine[0].replace(/^.*?:\s*/, ''));

  // 📂 Filing Location
  // 1) fenced code block under "Filing Location" section
  const fence =
    text.match(/📂?\s*Filing\s*Location[\s\S]*?```([\s\S]*?)```/i) ||
    text.match(/(^|\n)\s*Filing\s*Location[\s\S]*?```([\s\S]*?)```/i);
  if (fence) {
    const raw = (fence[1] || fence[2] || '').trim();
    if (raw) out.filingLocation = clean(raw.split('\n')[0]);
  } else {
    // 2) single-backtick inline
    const inline =
      text.match(/📂?\s*Filing\s*Location[\s\S]*?`([^`]+)`/i) ||
      text.match(/(^|\n)\s*Filing\s*Location[\s\S]*?`([^`]+)`/i);
    if (inline) out.filingLocation = clean(inline[1] || inline[2]);
    else {
      // 3) plain after colon on same line
      const flat = text.match(/^[^\S\r\n]*.*?\bFiling\s*Location\s*:\s*([^\r\n]+)/gmi);
      if (flat?.[0]) out.filingLocation = clean(flat[0].replace(/^.*?:\s*/, ''));
    }
  }

  return out;
}
