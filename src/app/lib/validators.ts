import 'server-only';
import { parseCard, detectCardKindFromContent } from './cards';

export type Explain = { reason: string };
export type ValidationResult =
  | { ok: true; kind: 'CodexCard' | 'CompletionCard' | 'Unknown'; explains: Explain[] }
  | { ok: false; kind: 'CodexCard' | 'CompletionCard'; errors: string[]; explains: Explain[] };

/**
 * Validates an uploaded card file (CodexCard, CompletionCard, or Unknown).
 * Matches requirements directly from the CodexCard_Template.md and CompletionCard_Template.md.
 */
export function validateMarkdownCard(content: string): ValidationResult {
  const kind = detectCardKindFromContent(content);
  const card = parseCard(content);
  const explains: Explain[] = [];

  // ---- CodexCard ----
  if (kind === 'CodexCard') {
    const errors: string[] = [];
    if (!card.loop) {
      errors.push('🔄 Loop Number is required (per CodexCard template).');
    } else {
      explains.push({ reason: `Loop Number found: ${card.loop}` });
    }
    if (!card.taskRef) {
      errors.push('🆔 Task Reference is required (per CodexCard template).');
    } else {
      explains.push({ reason: `Task Reference found: ${card.taskRef}` });
    }
    if (!/📅\s*\**Date Issued/i.test(content)) {
      errors.push('📅 Date Issued is required (per CodexCard template).');
    } else {
      explains.push({ reason: 'Date Issued found.' });
    }
    explains.push({ reason: 'Detected CodexCard via header or required fields.' });
    return errors.length
      ? { ok: false, kind, errors, explains }
      : { ok: true, kind, explains };
  }

  // ---- CompletionCard ----
  if (kind === 'CompletionCard') {
    const errors: string[] = [];
    if (!/✅\s*\**Completed Task/i.test(content)) {
      errors.push('✅ Completed Task is required (per CompletionCard template).');
    } else {
      explains.push({ reason: 'Completed Task found.' });
    }
    if (!card.loop) {
      errors.push('🔄 Loop Number is required (per CompletionCard template).');
    } else {
      explains.push({ reason: `Loop Number found: ${card.loop}` });
    }
    if (!card.taskRef) {
      errors.push('🆔 Task Reference is required (per CompletionCard template).');
    } else {
      explains.push({ reason: `Task Reference found: ${card.taskRef}` });
    }
    if (!/📅\s*\**Date Completed/i.test(content)) {
      errors.push('📅 Date Completed is required (per CompletionCard template).');
    } else {
      explains.push({ reason: 'Date Completed found.' });
    }
    if (!card.filingLocation) {
      explains.push({ reason: 'No 📂 Filing Location — rules will determine destination.' });
    } else {
      explains.push({ reason: `Filing Location specified: ${card.filingLocation}` });
    }
    explains.push({ reason: 'Detected CompletionCard via header or required fields.' });
    return errors.length
      ? { ok: false, kind, errors, explains }
      : { ok: true, kind, explains };
  }

  // ---- Unknown ----
  explains.push({ reason: 'Not a recognised Card — will use filename & structure heuristics.' });
  return { ok: true, kind: 'Unknown', explains };
}
