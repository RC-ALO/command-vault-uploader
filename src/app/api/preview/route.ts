import 'server-only';
import { NextResponse } from 'next/server';
import { computePath } from '../../lib/rules';
import { validateMarkdownCard } from '../../lib/validators';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { target, filename, brand, content } = await req.json();

  // Validate markdown-based cards
  let explains: { reason: string }[] = [];
  if (content && /\.md$/i.test(filename)) {
    const v = validateMarkdownCard(content);
    explains = v.explains;
    if (!v.ok) {
      return NextResponse.json(
        { error: 'Validation failed', errors: v.errors, explains },
        { status: 400 }
      );
    }
  }

  // Compute path
  const result = computePath({ target, filename, brand, content });

  // Build "why"
  const why: string[] = [];
  if (explains.length) why.push(...explains.map(e => e.reason));
  if (result.detected.docType) why.push(`Detected type: ${result.detected.docType}`);
  if (target === 'operationHarmony' && !brand) why.push('Brand missing — please choose a brand.');
  if (result.warnings.length) why.push(...result.warnings);

  return NextResponse.json({ ...result, why });
}
