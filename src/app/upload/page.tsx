'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { TargetKey } from '../lib/rules';
import { computePath, rethinkAllTargets } from '../lib/rules';

const targetLabels: Record<TargetKey, { label: string; sub: string }> = {
  operationHarmony: { label: 'Operation Harmony', sub: '/Operation Harmony/' },
  runtimeCodex:     { label: 'CODEX (runtime)',   sub: '/CODEX/' },
  configCodex:      { label: 'codex (config)',    sub: '/codex/' },
};

export default function UploadPage() {
  const sp = useSearchParams();
  const initialTarget = (sp.get('target') as TargetKey) || 'operationHarmony';

  const [target, setTarget] = useState<TargetKey>(initialTarget);
  const [brand, setBrand]   = useState(''); // still needed for OH routing
  const [pickedName, setPickedName] = useState<string | null>(null);

  const [primaryPath, setPrimaryPath] = useState('');
  const [warnings, setWarnings]       = useState<string[]>([]);
  const [disagree, setDisagree]       = useState(false);
  const [alternates, setAlternates]   = useState<Array<{path:string;reason:string}>>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTarget(initialTarget), [initialTarget]);

  const recompute = (fname: string | null) => {
    if (!fname) {
      setPrimaryPath(''); setWarnings([]); setAlternates([]); return;
    }
    const res = computePath({
      target,
      filename: fname,
      brand: target === 'operationHarmony' ? (brand || undefined) : undefined,
    });
    setPrimaryPath(res.primaryPath);
    setWarnings(res.warnings);
    // Clear alternates when recomputing baseline
    setAlternates([]);
  };

  const onFileChange = () => {
    const f = inputRef.current?.files?.[0] || null;
    const name = f ? f.name : null;
    setPickedName(name);
    recompute(name);
  };

  const onDisagreeToggle = (checked: boolean) => {
    setDisagree(checked);
    if (checked && pickedName) {
      const rr = rethinkAllTargets(pickedName, brand || undefined);
      setAlternates([{ path: rr.primary.primaryPath, reason: 'System re-evaluation (best alternate)' }, ...rr.others]);
    } else {
      setAlternates([]);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Fixed Back Button */}
      <div className="fixed top-4 left-4 z-50">
        <Link
          href="/"
          className="inline-block rounded-lg px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-blue-300 hover:text-blue-200 shadow"
        >
          ← Back
        </Link>
      </div>

      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold">Upload to Command Vault</h1>
            <p className="text-gray-300">
              Selected target: <span className="font-bold">{targetLabels[target].label}</span>
              <span className="ml-1 text-gray-500">({targetLabels[target].sub})</span>
            </p>
          </div>

          {/* Brand input (only if Operation Harmony) */}
          {target === 'operationHarmony' && (
            <div className="bg-gray-800 rounded-2xl p-4">
              <label className="block text-sm text-gray-400 mb-1">Brand (required)</label>
              <input
                className="w-full bg-gray-900 rounded-lg p-2"
                placeholder="e.g., TechCycle & Gadcet"
                value={brand}
                onChange={(e)=>{ setBrand(e.target.value); if (pickedName) recompute(pickedName); }}
              />
            </div>
          )}

          {/* Choose Files */}
          <div className="rounded-2xl p-6 bg-gray-800 border border-gray-700 text-center">
            <label className="block text-sm text-gray-400 mb-2">Choose file(s)</label>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={onFileChange}
              className="mx-auto block w-full text-white file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-500"
            />
            <div className="text-xs text-gray-500 mt-2">We’ll decide the path automatically.</div>
          </div>

          {/* Primary Path */}
          <div className="rounded-2xl p-5 bg-gray-800">
            <div className="text-gray-400 text-sm">Primary Path</div>
            <div className="mt-1 font-mono break-all">{primaryPath || '—'}</div>
            {warnings.length > 0 && (
              <div className="mt-2 text-sm text-yellow-300">
                {warnings.map((w,i)=>(<div key={i}>⚠️ {w}</div>))}
              </div>
            )}
          </div>

          {/* Don’t agree? */}
          <div className="rounded-2xl p-5 bg-gray-800 space-y-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={disagree}
                onChange={(e)=>onDisagreeToggle(e.target.checked)}
              />
              <span className="text-sm">Don’t agree with this pathing — re‑think and show alternates</span>
            </label>

            {disagree && alternates.length > 0 && (
              <div className="text-sm">
                <div className="text-gray-400">System suggestions</div>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  {alternates.map((s, i) => (
                    <li key={i}>
                      <span className="font-mono break-all">{s.path}</span>
                      <span className="text-gray-400"> — {s.reason}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-xs text-gray-500">
                  Suggestions are advisory; the system still places files via the Primary Path unless governance says otherwise.
                </div>
              </div>
            )}
          </div>

          <footer className="text-xs text-gray-500 text-center">
            This page shows routing only. Upload comes after rules are signed off.
          </footer>
        </div>
      </div>
    </main>
  );
}


