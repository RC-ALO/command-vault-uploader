'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type TargetKey = 'operationHarmony' | 'runtimeCodex' | 'configCodex';

const labels: Record<TargetKey, { label: string; sub: string }> = {
  operationHarmony: { label: 'Operation Harmony', sub: '/Operation Harmony/' },
  runtimeCodex: { label: 'CODEX (runtime)', sub: '/CODEX/' },
  configCodex: { label: 'codex (config)', sub: '/codex/' },
};

type Suggestion = { path: string; reason: string };

// Temporary test PINs (Phase 1). Phase 2: move to server-side & audit log.
const TEST_PINS: Record<string, string> = {
  '1066': 'Ryan Chambers',
  '4791': 'Shukur Ali',
};

export default function UploadPage() {
  const sp = useSearchParams();
  const initial = (sp.get('target') as TargetKey) || 'operationHarmony';

  const [target, setTarget] = useState<TargetKey>(initial);
  const [brand, setBrand] = useState(''); // only used for Operation Harmony
  const [pickedName, setPickedName] = useState<string | null>(null);

  const [primaryPath, setPrimaryPath] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [why, setWhy] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const [preferFiling, setPreferFiling] = useState<boolean>(false);

  // Re-think flow
  const [disagree, setDisagree] = useState(false);
  const [alternates, setAlternates] = useState<Suggestion[]>([]);

  // Card metadata (from API)
  const [card, setCard] = useState<{
    kind?: string;
    loop?: string;
    taskRef?: string;
    filingLocation?: string;
  } | null>(null);

  // PIN override state
  const [pin, setPin] = useState('');
  const [pinOwner, setPinOwner] = useState<string | null>(null);
  const [selectedAltIdx, setSelectedAltIdx] = useState<number>(0);
  const [overrideApplied, setOverrideApplied] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keep state in sync with URL param
  useEffect(() => setTarget(initial), [initial]);

  const preview = async (file: File) => {
    setErrors([]);
    setWhy([]);
    setCard(null);
    setOverrideApplied(false); // new file resets override

    // Treat markdown + plain‑text as parseable card content
    const isTextLike =
      file.type.startsWith('text/') || /\.(md|markdown|txt)$/i.test(file.name);

    // safety: 2 MB guard
    const content =
      isTextLike && file.size < 2_000_000 ? await file.text() : undefined;

    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target,
        filename: file.name,
        brand: target === 'operationHarmony' ? (brand || undefined) : undefined,
        content,                 // lets server parse Codex/Completion cards
        preferFiling: preferFiling, // toggle (server honors when valid)
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setErrors(json.errors || [json.error || 'Preview failed']);
      setPrimaryPath('');
      setWarnings([]);
      setAlternates([]);
      setWhy((json.explains || []).map((e: any) => e.reason));
      setCard(json.card || null);
      return;
    }

    setPrimaryPath(json.primaryPath || '');
    setWarnings(json.warnings || []);
    setWhy(json.why || []);
    setAlternates([]); // fetched only when "disagree" is toggled
    setCard(json.card || null);
  };

  const onFileChange = async () => {
    const f = inputRef.current?.files?.[0] || null;
    setPickedName(f ? f.name : null);
    setDisagree(false);
    setAlternates([]);
    setPin('');
    setPinOwner(null);
    setSelectedAltIdx(0);
    setOverrideApplied(false);
    if (f) await preview(f);
    else {
      setPrimaryPath('');
      setWarnings([]);
      setAlternates([]);
      setWhy([]);
      setErrors([]);
      setCard(null);
    }
  };

  // Prefer filing toggle re-runs preview if a file is selected
  useEffect(() => {
    const f = inputRef.current?.files?.[0];
    if (f) preview(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferFiling]);

  // Brand change (only for Operation Harmony) re-runs preview if a file is selected
  useEffect(() => {
    if (target !== 'operationHarmony') return;
    const f = inputRef.current?.files?.[0];
    if (f) preview(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  const onDisagreeToggle = async (checked: boolean) => {
    setDisagree(checked);
    setOverrideApplied(false);
    if (!checked || !pickedName) {
      setAlternates([]);
      return;
    }

    const res = await fetch('/api/rethink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: pickedName, brand: brand || undefined }),
    });
    const json = await res.json();
    if (!res.ok) {
      setAlternates([{ path: '—', reason: json.error || 'Rethink failed' }]);
      return;
    }

    const alts: Suggestion[] = [
      { path: json.primary.primaryPath, reason: 'System re‑evaluation (best alternate)' },
      ...(json.others || []),
    ];
    setAlternates(alts);
    setSelectedAltIdx(0);
  };

  const verifyPin = (value: string) => {
    setPin(value);
    const owner = TEST_PINS[value.trim()];
    setPinOwner(owner || null);
    if (!owner) setOverrideApplied(false);
  };

  const applyOverride = () => {
    if (!pinOwner || alternates.length === 0) return;
    const chosen = alternates[selectedAltIdx];
    setPrimaryPath(chosen.path);
    // Add a local "why" note to reflect override (client-side trace)
    setWhy((prev) => [
      ...prev,
      `Override selected by ${pinOwner} (PIN) — using alternate: ${chosen.path}`,
    ]);
    setOverrideApplied(true);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Back */}
      <div className="fixed top-4 left-4 z-50">
        <Link
          href="/"
          className="inline-block rounded-lg px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-blue-300 hover:text-blue-200 shadow"
        >
          ← Back
        </Link>
      </div>

      {/* Centered container */}
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold">Upload to Command Vault</h1>
            <p className="text-gray-300">
              Selected target:{' '}
              <span className="font-bold">{labels[target].label}</span>
              <span className="ml-1 text-gray-500">({labels[target].sub})</span>
            </p>
          </div>

          {/* Operation Harmony brand (only when needed) */}
          {target === 'operationHarmony' && (
            <div className="bg-gray-800 rounded-2xl p-4">
              <label className="block text-sm text-gray-400 mb-1">
                Brand <span className="text-gray-500">(required)</span>
              </label>
              <input
                className="w-full bg-gray-900 rounded-lg p-2"
                placeholder="e.g., TechCycle & Gadcet"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Must match an existing brand under OPERATION HARMONY.
              </p>
            </div>
          )}

          {/* Choose file(s) */}
          <div className="rounded-2xl p-6 bg-gray-800 border border-gray-700 text-center">
            <label className="block text-sm text-gray-400 mb-2">Choose file(s)</label>
            <input
              ref={inputRef}
              type="file"
              multiple={false}
              onChange={onFileChange}
              className="mx-auto block w-full text-white file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-500"
            />
            <div className="text-xs text-gray-500 mt-2">
              We’ll decide the path automatically.
            </div>
          </div>

          {/* Preference toggle (CompletionCards) */}
          <div className="rounded-2xl p-5 bg-gray-800">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={preferFiling}
                onChange={(e) => setPreferFiling(e.target.checked)}
              />
              <span className="text-sm">Prefer filing location when valid</span>
            </label>
            <div className="mt-1 text-xs text-gray-500">
              Applies to <em>CompletionCards</em>: if the card includes a 📂 Filing Location and it
              sits inside the allowed Command Vault tree, the system will prefer it.
            </div>
          </div>

          {/* Primary Path / Results */}
          <div className="rounded-2xl p-5 bg-gray-800">
            <div className="text-gray-400 text-sm">Primary Path</div>
            <div className="mt-1 font-mono break-all">{primaryPath || '—'}</div>

            {overrideApplied && pinOwner && (
              <div className="mt-2 text-xs inline-flex items-center gap-2 rounded bg-emerald-700/30 px-3 py-1">
                <span>Override active</span>
                <span className="font-semibold">{pinOwner}</span>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-2 text-sm text-yellow-300">
                {warnings.map((w, i) => (
                  <div key={i}>⚠️ {w}</div>
                ))}
              </div>
            )}

            {why.length > 0 && (
              <div className="mt-2 text-sm text-blue-300">
                {why.map((r, i) => (
                  <div key={i}>ℹ️ {r}</div>
                ))}
              </div>
            )}

            {errors.length > 0 && (
              <div className="mt-2 text-sm text-red-300">
                {errors.map((e, i) => (
                  <div key={i}>⛔ {e}</div>
                ))}
              </div>
            )}

            {/* Card fields read */}
            {card && (
              <div className="mt-3 rounded-lg bg-gray-800/70 p-3 text-sm">
                <div className="text-gray-400">Card fields read</div>
                <div className="mt-1 grid grid-cols-1 gap-1 font-mono">
                  {card.kind && <div>Kind: {card.kind}</div>}
                  {card.loop && <div>Loop: {card.loop}</div>}
                  {card.taskRef && <div>TaskRef: {card.taskRef}</div>}
                  {card.filingLocation && (
                    <div className="break-all">Filing Location: {card.filingLocation}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rethink + PIN override */}
          <div className="rounded-2xl p-5 bg-gray-800 space-y-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={disagree}
                onChange={(e) => onDisagreeToggle(e.target.checked)}
              />
              <span className="text-sm">
                Don’t agree with this pathing — re‑think and show alternates
              </span>
            </label>

            {disagree && (
              <div className="space-y-3">
                {/* PIN entry */}
                <div className="rounded-lg bg-gray-900/60 p-3">
                  <div className="text-sm text-gray-300 mb-1">Override PIN</div>
                  <div className="flex items-center gap-2">
                    <input
                      value={pin}
                      onChange={(e) => verifyPin(e.target.value)}
                      placeholder="Enter PIN to unlock selection"
                      className="flex-1 bg-gray-900 rounded-lg p-2 font-mono"
                    />
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        pinOwner
                          ? 'bg-emerald-700/30 text-emerald-200'
                          : 'bg-gray-700/40 text-gray-300'
                      }`}
                    >
                      {pinOwner ? `PIN owner: ${pinOwner}` : 'Locked'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Test PINs: 1066 (Ryan Chambers), 4791 (Shukur Ali). In Phase 2 this will be
                    server‑verified and audited.
                  </p>
                </div>

                {/* Alternates list */}
                <div className="rounded-lg bg-gray-900/50 p-3">
                  <div className="text-sm text-gray-300">System suggestions</div>
                  {alternates.length === 0 ? (
                    <div className="text-xs text-gray-500 mt-1">—</div>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {alternates.map((s, i) => {
                        const disabled = !pinOwner;
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <input
                              type="radio"
                              name="altPick"
                              disabled={disabled}
                              checked={selectedAltIdx === i}
                              onChange={() => setSelectedAltIdx(i)}
                              className="mt-1 h-4 w-4"
                            />
                            <div className={`${disabled ? 'opacity-60' : ''}`}>
                              <div className="font-mono break-all">{s.path}</div>
                              <div className="text-gray-400 text-xs">— {s.reason}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      disabled={!pinOwner || alternates.length === 0}
                      onClick={applyOverride}
                      className={`rounded-lg px-3 py-1.5 shadow ${
                        !pinOwner || alternates.length === 0
                          ? 'bg-gray-700 text-gray-400'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      Apply override
                    </button>
                    {overrideApplied && pinOwner && (
                      <span className="text-xs text-emerald-300">
                        Override applied by {pinOwner}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Overrides require a valid PIN and are logged locally in the preview.
                  In Phase 2 we’ll move the PIN check + audit trail server‑side.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
