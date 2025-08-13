import 'server-only';
import { NextResponse } from 'next/server';
import { computePath } from '../../lib/rules';
import { validateMarkdownCard } from '../../lib/validators';
import { parseCard } from '../../lib/cards';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { target, filename, brand, content } = await req.json();

  // Validate markdown/txt cards when we have text content
  let explains: { reason: string }[] = [];
  let cardMeta: { kind?: string; loop?: string; taskRef?: string; filingLocation?: string } | null = null;

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

  // Compute the primary path using the rules
  const result = computePath({ target, filename, brand, content });

  // Build the WHY trace
  const why: string[] = [];
  if (explains.length) why.push(...explains.map(e => e.reason));
  if (result.detected.docType) why.push(`Detected type: ${result.detected.docType}`);
  if (target === 'operationHarmony' && !brand) why.push('Brand missing — please choose a brand.');
  if (result.warnings.length) why.push(...result.warnings);

  // Surface filing location if present, and whether it aligns
  if (cardMeta?.filingLocation) {
    why.push(`Card’s 📂 Filing Location: ${cardMeta.filingLocation}`);
    if (result.primaryPath.startsWith(cardMeta.filingLocation)) {
      why.push('Primary path aligns with the card’s Filing Location.');
    } else {
      why.push('Primary path differs from the card’s Filing Location — governance rules took precedence.');
    }
  }

  return NextResponse.json({ ...result, why, card: cardMeta });
}

