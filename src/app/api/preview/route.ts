import 'server-only';
import { NextResponse } from 'next/server';
import { computePath } from '../../lib/rules';
import { validateMarkdownCard } from '../../lib/validators';
import { parseCard } from '../../lib/cards';
import { loadAllowedPrefixes } from '../../lib/structure'; // we only *read* the roots here

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { target, filename, brand, content, preferFiling } = await req.json();

  // 1) Validate text-like uploads as Cards (Codex/Completion) when we have content
  let explains: { reason: string }[] = [];
  let cardMeta:
    | { kind?: 'CodexCard' | 'CompletionCard' | 'Unknown'; loop?: string; taskRef?: string; filingLocation?: string }
    | null = null;

  if (content) {
    const v = validateMarkdownCard(content);
    explains = v.explains;
    if (!v.ok) {
      return NextResponse.json(
        { error: 'Validation failed', errors: v.errors, explains },
        { status: 400 }
      );
    }
    const card = parseCard(content);
    cardMeta = {
      kind: v.kind,
      loop: card.loop,
      taskRef: card.taskRef,
      filingLocation: card.filingLocation,
    };
  }

  // 2) Compute baseline path using rules (governed defaults)
  const result = computePath({ target, filename, brand, content });

  // 3) Build WHY trace
  const why: string[] = [];
  if (explains.length) why.push(...explains.map((e) => e.reason));
  if (result.detected.docType) why.push(`Detected type: ${result.detected.docType}`);
  if (target === 'operationHarmony' && !brand) why.push('Brand missing — please choose a brand.');
  if (result.warnings.length) why.push(...result.warnings);

  // 4) Prefer Filing Location (CompletionCards) when valid and requested
  // CompletionCards are designed to specify their final folder via 📂 Filing Location:contentReference[oaicite:7]{index=7}.
  const allowedRoots = loadAllowedPrefixes(); // usually: "Command Vault/", "Command Vault/CODEX/", "Command Vault/OPERATION HARMONY/", "Command Vault/codex/"
  let primaryPath = result.primaryPath;

  if (preferFiling && cardMeta?.kind === 'CompletionCard' && cardMeta.filingLocation) {
    // Ensure filename is included in the proposed path
    const proposed = cardMeta.filingLocation.endsWith(filename)
      ? cardMeta.filingLocation
      : `${cardMeta.filingLocation}/${filename}`;

    // Check against governed roots from the structure doc:contentReference[oaicite:8]{index=8}.
    const isAllowed = allowedRoots.some((root) => proposed.startsWith(root));
    if (isAllowed) {
      primaryPath = proposed;
      why.push('Preferred card 📂 Filing Location was inside allowed roots — honoring the card path.');
    } else {
      why.push('Card’s 📂 Filing Location is outside allowed Command Vault roots — governance kept the system path.');
    }

    // Show what the card asked for, either way
    why.push(`Card’s 📂 Filing Location: ${cardMeta.filingLocation}`);
  }

  // 5) Return preview
  return NextResponse.json({
    ...result,
    primaryPath, // may be overridden if preferFiling applied
    why,
    card: cardMeta,
  });
}
