import 'server-only';
import { parseCard, detectCardKindFromContent } from './cards';

export type Explain = { reason: string };

export type ValidationResult =
  | { ok: true; kind: 'CodexCard' | 'CompletionCard' | 'Unknown'; explains: Explain[] }
  | { ok: false; kind: 'CodexCard' | 'CompletionCard'; errors: string[]; explains: Explain[] };

/**
 * Validates a markdown/txt card:
 *  - CodexCard requires: Loop Number, Task Reference, Date Issued
 *  - CompletionCard requires: Completed Task, Loop Number, Task Reference, Date Completed:contentReference[oaicite:6]{index=6}
 *  - Filing Location on CompletionCard is advisory but can be preferred by policy/flag.
 */
export function validateMarkdownCard(content: string): ValidationResult {
  const kind = detectCardKindFromContent(content);
  const card = parseCard(content);
  const explains: Explain[] = [];

  if (kind === 'CodexCard') {
    const errors: string[] = [];

    if (!card.loop) errors.push('🔄 Loop Number is required (per CodexCard template).');
    else explains.push({ reason: `Loop Number found: ${card.loop}` });

    if (!card.taskRef) errors.push('🆔 Task Reference is required (per CodexCard template).');
    else explains.push({ reason: `Task Reference found: ${card.taskRef}` });

    const hasIssued = /(^|\n)\s*.*?Date\s*Issued\s*:\s*.+/i.test(content);
    if (!hasIssued) errors.push('📅 Date Issued is required (per CodexCard template).');
    else explains.push({ reason: 'Date Issued found.' });

    explains.push({ reason: 'Detected CodexCard via header or required fields.' });
    return errors.length ? { ok: false, kind, errors, explains } : { ok: true, kind, explains };
  }

  if (kind === 'CompletionCard') {
    const errors: string[] = [];

    const hasCompletedTask = /(^|\n)\s*.*?Completed\s*Task\s*:\s*.+/i.test(content);
    if (!hasCompletedTask) errors.push('✅ Completed Task is required (per CompletionCard template).');
    else explains.push({ reason: 'Completed Task found.' });

    if (!card.loop) errors.push('🔄 Loop Number is required (per CompletionCard template).');
    else explains.push({ reason: `Loop Number found: ${card.loop}` });

    if (!card.taskRef) errors.push('🆔 Task Reference is required (per CompletionCard template).');
    else explains.push({ reason: `Task Reference found: ${card.taskRef}` });

    const hasDateCompleted = /(^|\n)\s*.*?Date\s*Completed\s*:\s*.+/i.test(content);
    if (!hasDateCompleted) errors.push('📅 Date Completed is required (per CompletionCard template).');
    else explains.push({ reason: 'Date Completed found.' });

    if (card.filingLocation) {
      explains.push({ reason: `Card includes 📂 Filing Location: ${card.filingLocation}` });
    } else {
      explains.push({ reason: 'No 📂 Filing Location — rules will determine destination.' });
    }

    explains.push({ reason: 'Detected CompletionCard via header or required fields.' });
    return errors.length ? { ok: false, kind, errors, explains } : { ok: true, kind, explains };
  }

  // Unknown (non‑card) → let routing heuristics decide; still return context
  explains.push({ reason: 'Not a recognised Card — using filename & structure heuristics.' });
  return { ok: true, kind: 'Unknown', explains };
}
