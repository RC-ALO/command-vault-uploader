import { NextResponse } from 'next/server';

// Same type as client-side
type RethinkBody = {
  filename: string;
  brand?: string;
  // Optional Phase‑1 PIN (client may pass it; we **echo** the owner for UI labelling)
  pin?: string;
};

// Temporary test PINs. Phase 2: move to server storage + audit persistence.
const TEST_PINS: Record<string, string> = {
  '1066': 'Ryan Chambers',
  '4791': 'Shukur Ali',
};

type Suggestion = { primaryPath: string; reason: string };
type Other = { path: string; reason: string };

function safeName(s: string) {
  return s.replace(/[<>:"\\|?*]+/g, '').replace(/\s+/g, ' ').trim();
}
function joinPath(...parts: string[]) {
  return parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

/**
 * Rethink strategy:
 * - We don’t have the parsed card here (client already previewed); we propose
 *   safe alternates that reviewers typically need and let the UI pick one.
 * - Later we’ll pass the parsed card + target here to craft smarter alternates.
 */
function proposeAlternates(filename: string, brand?: string) {
  const name = safeName(filename);

  const primary: Suggestion = {
    primaryPath: joinPath(
      'Command Vault',
      'CODEX',
      'Ops Intelligence',
      'Training & Guides',
      name
    ),
    reason: 'General fallback for non-loop items (training/reference).',
  };

  const others: Other[] = [
    {
      path: joinPath('Command Vault', 'CODEX', 'Ops Intelligence', 'Archive', name),
      reason: 'Alternate: archive this reference inside Ops Intelligence.',
    },
    {
      path: joinPath('Command Vault', 'CODEX', 'Standards & SOPs', 'Drafts Under Review', name),
      reason: 'Alternate: treat as SOP draft under review.',
    },
  ];

  if (brand) {
    others.push({
      path: joinPath(
        'Command Vault',
        'OPERATION HARMONY',
        brand,
        'Operations',
        'SOPs & Playbooks',
        name
      ),
      reason: 'Alternate: business-side SOP for selected brand.',
    });
  }

  return { primary, others };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RethinkBody;
    if (!body?.filename) {
      return NextResponse.json(
        { error: 'Missing required field: filename' },
        { status: 400 }
      );
    }

    const pinOwner = body.pin ? TEST_PINS[body.pin.trim()] || null : null;

    const { primary, others } = proposeAlternates(body.filename, body.brand);

    return NextResponse.json({
      primary,
      others,
      override: {
        pinOwner, // null unless the provided PIN matches our (temporary) registry
        // In Phase 2 we’ll persist an audit entry here with chosen path + actor
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Rethink failed' },
      { status: 500 }
    );
  }
}
