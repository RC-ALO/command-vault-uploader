import 'server-only';
import { NextResponse } from 'next/server';
import { computePath } from '../../lib/rules';
import { validateMarkdownCard } from '../../lib/validators';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { target, filename, brand, content } = await req.json();

  // If we have text content, try to validate as a Card (Codex/Completion)
  let explains: { reason: string }[] = [];
  if (content) {
    const v = validateMarkdownCard(content);
    explains = v.explains;
    if (!v.ok) {
      return NextResponse.json(
        { error: 'Validation failed', errors: v.errors, explains },
        { status: 400 }
      );
    }
  }

  const result = computePath({ target, filename, brand, content });

  const why: string[] = [];
  if (explains.length) why.push(...explains.map(e => e.reason));
  if (result.detected.docType) why.push(`Detected type: ${result.detected.docType}`);
  if (target === 'operationHarmony' && !brand) why.push('Brand missing — please choose a brand.');
  if (result.warnings.length) why.push(...result.warnings);

  return NextResponse.json({ ...result, why });
}

