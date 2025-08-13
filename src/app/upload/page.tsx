'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type TargetKey = 'operationHarmony' | 'runtimeCodex' | 'configCodex';

const labels: Record<TargetKey, {label:string; sub:string}> = {
  operationHarmony: { label: 'Operation Harmony', sub: '/Operation Harmony/' },
  runtimeCodex:     { label: 'CODEX (runtime)',   sub: '/CODEX/' },
  configCodex:      { label: 'codex (config)',    sub: '/codex/' },
};

export default function UploadPage() {
  const sp = useSearchParams();
  const initial = (sp.get('target') as TargetKey) || 'operationHarmony';

  const [target, setTarget] = useState<TargetKey>(initial);
  const [brand, setBrand] = useState('');
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [primaryPath, setPrimaryPath] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [why, setWhy] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [disagree, setDisagree] = useState(false);
  const [alternates, setAlternates] = useState<Array<{path:string;reason:string}>>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setTarget(initial), [initial]);

 const preview = async (file: File) => {
  setErrors([]); setWhy([]);

  // Read body for .md, .markdown, .txt or any text/*
  const isTextLike =
    file.type.startsWith('text/') || /\.(md|markdown|txt)$/i.test(file.name);
  const content =
    isTextLike && file.size < 2_000_000 ? await file.text() : undefined;

  const res = await fetch('/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target,
      filename: file.name,
      brand: target === 'operationHarmony' ? (brand || undefined) : undefined,
      content, // <-- key: send body so validators/rules can parse cards
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    setErrors(json.errors || [json.error || 'Preview failed']);
    setPrimaryPath(''); setWarnings([]); setAlternates([]);
    setWhy((json.explains || []).map((e: any) => e.reason));
    return;
  }

  setPrimaryPath(json.primaryPath);
  setWarnings(json.warnings || []);
  setWhy(json.why || []);
  setAlternates([]);
};


  const onFileChange = async () => {
    const f = inputRef.current?.files?.[0] || null;
    setPickedName(f ? f.name : null);
    if (f) await preview(f);
    else { setPrimaryPath(''); setWarnings([]); setAlternates([]); setWhy([]); setErrors([]); }
  };

  const onDisagreeToggle = async (checked: boolean) => {
    setDisagree(checked);
    if (!checked || !pickedName) { setAlternates([]); return; }
    const res = await fetch('/api/rethink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: pickedName, brand: brand || undefined }),
    });
    const json = await res.json();
    if (!res.ok) { setAlternates([{ path: '—', reason: json.error || 'Rethink failed' }]); return; }
    setAlternates([
      { path: json.primary.primaryPath, reason: 'System re‑evaluation (best alternate)' },
      ...json.others,
    ]);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="fixed top-4 left-4 z-50">
        <Link href="/" className="inline-block rounded-lg px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-blue-300 hover:text-blue-200 shadow">← Back</Link>
      </div>

      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold">Upload to Command Vault</h1>
            <p className="text-gray-300">
              Selected target: <span className="font-bold">{labels[target].label}</span>
              <span className="ml-1 text-gray-500">({labels[target].sub})</span>
            </p>
          </div>

          {target === 'operationHarmony' && (
            <div className="bg-gray-800 rounded-2xl p-4">
              <label className="block text-sm text-gray-400 mb-1">Brand (required)</label>
              <input
                className="w-full bg-gray-900 rounded-lg p-2"
                placeholder="e.g., TechCycle & Gadcet"
                value={brand}
                onChange={(e)=>{ setBrand(e.target.value); if (pickedName && inputRef.current?.files?.[0]) preview(inputRef.current.files[0]); }}
              />
            </div>
          )}

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

          <div className="rounded-2xl p-5 bg-gray-800">
            <div className="text-gray-400 text-sm">Primary Path</div>
            <div className="mt-1 font-mono break-all">{primaryPath || '—'}</div>
            {warnings.length > 0 && (
              <div className="mt-2 text-sm text-yellow-300">
                {warnings.map((w,i)=>(<div key={i}>⚠️ {w}</div>))}
              </div>
            )}
            {why.length > 0 && (
              <div className="mt-2 text-sm text-blue-300">
                {why.map((r,i)=>(<div key={i}>ℹ️ {r}</div>))}
              </div>
            )}
            {errors.length > 0 && (
              <div className="mt-2 text-sm text-red-300">
                {errors.map((e,i)=>(<div key={i}>⛔ {e}</div>))}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-5 bg-gray-800 space-y-3">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={disagree} onChange={(e)=>onDisagreeToggle(e.target.checked)} />
              <span className="text-sm">Don’t agree with this pathing — re‑think and show alternates</span>
            </label>
            {disagree && alternates.length > 0 && (
              <div className="text-sm">
                <div className="text-gray-400">System suggestions</div>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  {alternates.map((s,i)=>(
                    <li key={i}><span className="font-mono break-all">{s.path}</span>
                      <span className="text-gray-400"> — {s.reason}</span></li>
                  ))}
                </ul>
                <div className="mt-2 text-xs text-gray-500">Suggestions are advisory; the system still places files via the Primary Path.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
