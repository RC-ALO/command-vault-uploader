'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-900 text-white">
      <div className="w-full max-w-xl space-y-8">
        {/* Title & Subtitle */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Command Vault</h1>
          <p className="text-gray-300">
            Select a primary target to start your upload. We’ll validate your choice and suggest
            other destinations if the rules match.
          </p>
        </div>

        {/* Primary target buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/upload?target=operationHarmony"
            className="rounded-2xl p-4 shadow border border-gray-600 bg-gray-700 hover:bg-gray-650"
          >
            <div className="font-medium">Operation Harmony</div>
            <div className="text-xs text-gray-400">/Operation Harmony/</div>
          </Link>

          <Link
            href="/upload?target=runtimeCodex"
            className="rounded-2xl p-4 shadow border border-gray-600 bg-gray-700 hover:bg-gray-650"
          >
            <div className="font-medium">CODEX (runtime)</div>
            <div className="text-xs text-gray-400">/Codex/</div>
          </Link>

          <Link
            href="/upload?target=configCodex"
            className="rounded-2xl p-4 shadow border border-gray-600 bg-gray-700 hover:bg-gray-650"
          >
            <div className="font-medium">codex (config)</div>
            <div className="text-xs text-gray-400">/codex/</div>
          </Link>
        </div>

        {/* Footer */}
        <footer className="text-xs text-gray-500 text-center">
          /codex/ uploads will be PR-gated for review.
        </footer>
      </div>
    </main>
  );
}


