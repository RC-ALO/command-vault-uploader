import 'server-only';
import * as fs from 'fs';
import * as path from 'path';

const STRUCT_MD = path.join(process.cwd(), 'config', 'command-vault', 'CommandVaultStructureV2.md');

export function loadAllowedPrefixes(): string[] {
  // Keep it simple: trust the base roots visible in the structure file
  const txt = fs.readFileSync(STRUCT_MD, 'utf8');
  const prefixes = new Set<string>();
  if (/^\s*Command Vault\//m.test(txt)) prefixes.add('Command Vault/');
  // Obvious roots under Command Vault
  [
    'Command Vault/CODEX/',
    'Command Vault/OPERATION HARMONY/',
    'Command Vault/codex/',
  ].forEach(p => prefixes.add(p));
  return Array.from(prefixes);
}

// Ensure a proposed path stays inside an allowed root
export function clampToAllowed(proposed: string, allowed: string[]): string {
  const clean = proposed.replace(/\\/g, '/');
  if (allowed.some(p => clean.startsWith(p))) return clean;

  // Walk up to find an allowed ancestor; otherwise return the master root
  const parts = clean.split('/').filter(Boolean);
  while (parts.length) {
    const test = parts.join('/') + '/';
    if (allowed.some(p => test.startsWith(p))) return test;
    parts.pop();
  }
  return 'Command Vault/';
}


