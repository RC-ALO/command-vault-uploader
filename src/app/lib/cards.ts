import 'server-only';
import * as fs from 'fs';
import * as path from 'path';

export type CardKind = 'CodexCard' | 'CompletionCard' | 'Unknown';

export interface ParsedCard {
  kind: CardKind;
  loop?: string;
  filingLocation?: string;
  taskRef?: string;
}

const base = path.join(process.cwd(), 'config', 'command-vault');
const CODEX_TEMPLATE = path.join(base, 'CodexCard_Template.md');
const COMPLETION_TEMPLATE = path.join(base, 'CompletionCard_Template.md');

export function detectCardKindFromContent(text: string): CardKind {
  // Primary: exact headers
  if (/^#\s*🗂️\s*CodexCard\b/im.test(text)) return 'CodexCard';
  if (/^#\s*🗂️\s*CompletionCard\b/im.test(text)) return 'CompletionCard';

  // Fallback: field-based detection (works if header is missing)
  const hasLoop = /(^|\n)🔄\s*\**Loop Number/i.test(text) || /(^|\n)Loop Number:/i.test(text);
  const hasTaskRef = /(^|\n)🆔\s*\**Task Reference/i.test(text) || /(^|\n)Task Reference:/i.test(text);
  const hasDateIssued = /📅\s*\**Date Issued/i.test(text);
  const hasDateCompleted = /📅\s*\**Date Completed/i.test(text);
  const hasCompletedTask = /(^|\n)✅\s*\**Completed Task/i.test(text) || /(^|\n)Completed Task:/i.test(text);

  // CodexCard needs loop + taskRef + Date Issued
  if (hasLoop && hasTaskRef && hasDateIssued) return 'CodexCard';

  // CompletionCard needs Completed Task + loop + taskRef + Date Completed
  if (hasCompletedTask && hasLoop && hasTaskRef && hasDateCompleted) return 'CompletionCard';

  return 'Unknown';
}

export function parseCard(text: string): ParsedCard {
  const kind = detectCardKindFromContent(text);
  const out: ParsedCard = { kind };

  // 🔄 Loop Number
  const loopMatch =
    text.match(/🔄\s*\*\*?Loop Number:?\*\*?\s*\[?([^\]\r\n]+)\]?/i) ||
    text.match(/(^|\n)\s*Loop Number:\s*\[?([^\]\r\n]+)\]?/i);
  if (loopMatch) out.loop = (loopMatch[1] || loopMatch[2]).trim();

  // 🆔 Task Reference
  const refMatch =
    text.match(/🆔\s*\*\*?Task Reference:?\*\*?\s*\[?([^\]\r\n]+)\]?/i) ||
    text.match(/(^|\n)\s*Task Reference:\s*\[?([^\]\r\n]+)\]?/i);
  if (refMatch) out.taskRef = (refMatch[1] || refMatch[2]).trim();

  // 📂 Filing Location (inline `path` or fenced ```path```)
  // 1) fenced code block – first backtick block under the Filing Location section
  const fence =
    text.match(/📂\s*Filing Location[\s\S]*?```([\s\S]*?)```/i) ||
    text.match(/(^|\n)\s*Filing Location[\s\S]*?```([\s\S]*?)```/i);
  if (fence) {
    const raw = (fence[1] || fence[2] || '').trim();
    if (raw) out.filingLocation = raw.split('\n')[0].trim();
  } else {
    // 2) single backticks inside that section
    const inline =
      text.match(/📂\s*Filing Location[\s\S]*?`([^`]+)`/i) ||
      text.match(/(^|\n)\s*Filing Location[\s\S]*?`([^`]+)`/i);
    if (inline) out.filingLocation = (inline[1] || inline[2]).trim();
  }

  return out;
}


export function getTemplate(kind: CardKind): string {
  const p = kind === 'CompletionCard' ? COMPLETION_TEMPLATE : CODEX_TEMPLATE;
  return fs.readFileSync(p, 'utf8');
}


