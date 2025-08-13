import { NextResponse } from 'next/server';
import { validateMarkdownCard } from '../../lib/validators';
import { parseCard } from '../../lib/cards';

// NOTE: light, explicit mapping for now. We’ll push this into rules/structure later.
type TargetKey = 'operationHarmony' | 'runtimeCodex' | 'configCodex';

type PreviewBody = {
  target: TargetKey;
  filename: string;
  brand?: string;
  content?: string;            // raw text for cards (.md/.txt)
  preferFiling?: boolean;      // UI toggle for CompletionCards
};

function safeName(s: string) {
  // keep human-readable but remove filesystem nasties
  return s.replace(/[<>:"\\|?*]+/g, '').replace(/\s+/g, ' ').trim();
}

function joinPath(...parts: string[]) {
  return parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

/** True when a filing location is inside the allowed Command Vault tree */
function filingIsInsideVault(path?: string) {
  if (!path) return false;
  const norm = path.replace(/\\/g, '/').trim();
  return /^Command Vault\//i.test(norm); // under Command Vault root only:contentReference[oaicite:5]{index=5}
}

function computePrimaryPath(
  target: TargetKey,
  filename: string,
  opts: {
    preferFiling?: boolean;
    cardKind?: string;
    loop?: string;
    filingLocation?: string;
    brand?: string;
  },
  why: string[],
  warnings: string[]
) {
  const name = safeName(filename);

  // --- Target: CODEX runtime (/CODEX) ---
  if (target === 'runtimeCodex') {
    // CompletionCard can prefer Filing Location if inside vault
    if (opts.cardKind === 'CompletionCard') {
      if (opts.preferFiling && filingIsInsideVault(opts.filingLocation)) {
        why.push('Card provides a 📂 Filing Location inside Command Vault; UI flag prefers it.');
        return opts.filingLocation!;
      }
      if (opts.loop) {
        // Completion usually files under the loop’s Archive or wrap-up
        why.push('CompletionCard with loop — routing into loop Archive per lifecycle.');
        return joinPath(
          'Command Vault',
          'CODEX',
          'Loops',
          opts.loop,
          'Archive',
          name
        ); // loop archive:contentReference[oaicite:6]{index=6}
      }
      warnings.push('No loop detected on CompletionCard — defaulting to Ops Intelligence Archive.');
      return joinPath(
        'Command Vault',
        'CODEX',
        'Ops Intelligence',
        'Archive',
        name
      ); // safe fallback:contentReference[oaicite:7]{index=7}
    }

    // CodexCard (active work) → Loops/<loop>/Active Tasks
    if (opts.cardKind === 'CodexCard' && opts.loop) {
      why.push('CodexCard with loop — placing under Loops/Active Tasks (working docs).');
      return joinPath(
        'Command Vault',
        'CODEX',
        'Loops',
        opts.loop,
        'Active Tasks',
        name
      ); // active tasks area:contentReference[oaicite:8]{index=8}
    }

    // Unknown or missing loop → Ops Intelligence / Training & Guides
    why.push('Not a recognised card with loop — using Ops Intelligence/Training & Guides.');
    return joinPath(
      'Command Vault',
      'CODEX',
      'Ops Intelligence',
      'Training & Guides',
      name
    ); // reference area:contentReference[oaicite:9]{index=9}
  }

  // --- Target: OPERATION HARMONY ---
  if (target === 'operationHarmony') {
    if (!opts.brand) {
      warnings.push('Brand is required for Operation Harmony; using top-level Archive.');
      return joinPath('Command Vault', 'OPERATION HARMONY', 'Archive', name);
    }
    // Sensible default: Operations/SOPs & Playbooks
    why.push('Business-side doc routed under Operations/SOPs & Playbooks for the selected brand.');
    return joinPath(
      'Command Vault',
      'OPERATION HARMONY',
      opts.brand,
      'Operations',
      'SOPs & Playbooks',
      name
    ); // brand structure:contentReference[oaicite:10]{index=10}
  }

  // --- Target: configCodex (/codex) read-only for ops, still return path preview ---
  why.push('codex (config store) is read-only to ops; preview shows intended config path.');
  return joinPath('Command Vault', 'CODEX', 'Control Deck', 'System Configs', name); // config area:contentReference[oaicite:11]{index=11}
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PreviewBody;

    if (!body || !body.filename || !body.target) {
      return NextResponse.json(
        { error: 'Missing required fields: target, filename.' },
        { status: 400 }
      );
    }

    const warnings: string[] = [];
    const why: string[] = [];
    let parsedCard:
      | { kind?: string; loop?: string; taskRef?: string; filingLocation?: string }
      | null = null;

    // Try to parse/validate cards when content is present
    if (body.content) {
      const validation = validateMarkdownCard(body.content);
      if (!validation.ok) {
        // show friendly errors but still compute a safe fallback path
        warnings.push('Card validation failed — see errors for details.');
      }
      validation.explains?.forEach((e) => why.push(e.reason));
      // parse once to extract fields for preview panel
      const c = parseCard(body.content);
      parsedCard = {
        kind: c.kind,
        loop: c.loop,
        taskRef: c.taskRef,
        filingLocation: c.filingLocation,
      };
      // If CodexCard/CompletionCard missing loop, nudge
      if ((c.kind === 'CodexCard' || c.kind === 'CompletionCard') && !c.loop) {
        warnings.push('No loop detected — select a loop or fix the card header/fields.');
      }
      if (c.kind === 'CompletionCard' && body.preferFiling) {
        if (c.filingLocation) {
          if (!filingIsInsideVault(c.filingLocation)) {
            warnings.push('Filing Location is outside Command Vault; ignoring preference.');
          } else {
            why.push('Prefer filing is ON and filing is inside Command Vault.');
          }
        } else {
          warnings.push('Prefer filing is ON but no Filing Location is present on the card.');
        }
      }
    } else {
      why.push('No card content provided — using filename/target heuristics.');
    }

    const primaryPath = computePrimaryPath(
      body.target,
      body.filename,
      {
        preferFiling: body.preferFiling,
        cardKind: parsedCard?.kind,
        loop: parsedCard?.loop,
        filingLocation: parsedCard?.filingLocation,
        brand: body.brand,
      },
      why,
      warnings
    );

    return NextResponse.json({
      primaryPath,
      warnings,
      why,
      card: parsedCard,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Preview failed' },
      { status: 500 }
    );
  }
}

