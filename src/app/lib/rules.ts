import 'server-only';
import { loadAllowedPrefixes, clampToAllowed } from './structure';
import { parseCard } from './cards';

export type TargetKey = 'operationHarmony' | 'runtimeCodex' | 'configCodex';
export type DocType =
  | 'LoopTask' | 'SOP' | 'OpsIntel' | 'SystemHealth' | 'ControlDeck'
  | 'Operations' | 'Marketing' | 'PeopleHR' | 'AIAutomation'
  | 'Finance' | 'Strategy' | 'ContentCreative' | 'Archive' | 'Generic';
export type SopStatus = 'Draft' | 'Final' | 'Superseded';

export interface RuleInput {
  target: TargetKey;
  filename: string;
  brand?: string;
  loopName?: string;
  sopStatus?: SopStatus;
  content?: string;
}
export interface RuleResult {
  primaryPath: string;
  suggestions: Array<{ path: string; reason: string }>;
  warnings: string[];
  detected: { docType: DocType; sopStatus?: SopStatus; loopName?: string };
}

const VAULT = 'Command Vault';
const OH = 'OPERATION HARMONY';
const CODEX = 'CODEX';
const CONFIG = 'codex';
const ALLOWED = loadAllowedPrefixes();

const todayIso = () => new Date().toISOString().slice(0, 10);
const yyyy = () => new Date().toISOString().slice(0, 4);
const mm = () => new Date().toISOString().slice(5, 7);
const safe = (s: string) => s.replace(/[/\\]/g, '_').replace(/\.\.\//g, '').trim();

// Which combos get dated subfolders?
function datedSegment(target: TargetKey, doc: DocType): string {
  if (target === 'runtimeCodex' && doc === 'SystemHealth') return `/${todayIso()}`; // logs
  if (target === 'operationHarmony' && doc === 'Finance') return `/${yyyy()}/${mm()}`; // reports
  return '';
}

// Tiny loop inference for non-cards
function inferLoopFromFilename(name: string): string | undefined {
  const m1 = name.match(/\bGenesis[ _-]?(\d{2})\b/i);
  if (m1) return `Genesis_${m1[1].padStart(2, '0')}`;
  const m2 = name.match(/\bLoop[ _-]?([A-Za-z0-9]+)\b/);
  if (m2) return m2[1];
  return undefined;
}

// Lightweight filename classifier
function classify(filename: string, target: TargetKey): DocType {
  const n = filename.toLowerCase();
  if (/(^|[\s_-])sop([\s_-]|\.|$)|standard|procedure|policy/.test(n)) return 'SOP';
  if (/(^|[\s_-])loop|codexcard|task|ticket/.test(n)) return 'LoopTask';
  if (/intel|guide|training|how[- ]?to|playbook/.test(n)) return 'OpsIntel';
  if (/health|log|audit|report/.test(n)) return 'SystemHealth';
  if (/directive|governance|admin|rule/.test(n)) return 'ControlDeck';

  if (/campaign|asset|brand|creative|logo|ad|social/.test(n)) return 'Marketing';
  if (/invoice|budget|forecast|p&l|profit|loss|balance/.test(n)) return 'Finance';
  if (/hiring|onboard|manager|hr/.test(n)) return 'PeopleHR';
  if (/prompt|automation|script|workflow/.test(n)) return 'AIAutomation';
  if (/okr|strategy|plan|review|decision/.test(n)) return 'Strategy';
  if (/form|checklist|process/.test(n) && target === 'operationHarmony') return 'Operations';
  if (/content|video|blog|copy/.test(n)) return 'ContentCreative';

  if (target === 'runtimeCodex') return 'OpsIntel';
  if (target === 'operationHarmony') return 'Operations';
  return 'Generic';
}

export function computePath(input: RuleInput): RuleResult {
  const filename = safe(input.filename);
  const warnings: string[] = [];
  const suggestions: Array<{ path: string; reason: string }> = [];

  // 1) Card-aware routing
  if (input.content) {
    const card = parseCard(input.content);

    if (card.kind === 'CodexCard' && card.loop) {
      const loop = card.loop || input.loopName || 'Genesis_01';
      const p = `${VAULT}/${CODEX}/Loops/${loop}/Active Tasks/${filename}`;
      return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: 'LoopTask', loopName: loop } };
    }

    if (card.kind === 'CompletionCard') {
      if (card.filingLocation) {
        const withFile = card.filingLocation.endsWith(filename) ? card.filingLocation : `${card.filingLocation}/${filename}`;
        return { primaryPath: clampToAllowed(withFile, ALLOWED), suggestions, warnings, detected: { docType: 'Generic' } };
      }
      const loop = card.loop || input.loopName || 'Genesis_01';
      const fallback = `${VAULT}/${CODEX}/Loops/${loop}/Loop Wrap-Up/${filename}`;
      return { primaryPath: clampToAllowed(fallback, ALLOWED), suggestions, warnings: ['CompletionCard without Filing Location → Loop Wrap‑Up fallback'], detected: { docType: 'Generic', loopName: loop } };
    }
  }

  // 2) Heuristic routing (non-cards)
  const detected = classify(input.filename, input.target);
  let status: SopStatus | undefined = input.sopStatus;
  let loop = input.loopName;
  if (detected === 'SOP' && !status) status = 'Draft';
  if (detected === 'LoopTask' && !loop) loop = inferLoopFromFilename(input.filename);

  if (input.target === 'operationHarmony') {
    if (!input.brand) warnings.push('Brand is required for Operation Harmony.');
    const brand = input.brand || 'UNSPECIFIED_BRAND';
    const base = `${VAULT}/${OH}/${brand}`;

    const map: Record<DocType, string> = {
      Operations:      `${base}/Operations/Processes & Forms`,
      Marketing:       `${base}/Marketing & Branding/Assets`,
      PeopleHR:        `${base}/People & HR/Hiring & Onboarding`,
      AIAutomation:    `${base}/AI & Automation/Prompts & Playbooks`,
      Finance:         `${base}/Finance/Reports`,
      Strategy:        `${base}/Strategy & Leadership/Plans & OKRs`,
      ContentCreative: `${base}/Content & Creative`,
      Archive:         `${base}/Archive`,
      LoopTask:        `${VAULT}/${CODEX}/Loops`,
      SOP:             `${VAULT}/${CODEX}/Standards & SOPs`,
      OpsIntel:        `${VAULT}/${CODEX}/Ops Intelligence`,
      SystemHealth:    `${VAULT}/${CODEX}/System Health`,
      ControlDeck:     `${VAULT}/${CODEX}/Control Deck`,
      Generic:         `${base}/Operations/Processes & Forms`,
    };

    const seg = datedSegment('operationHarmony', detected); // Finance → YYYY/MM
    const proposed = `${map[detected]}${seg}/${filename}`;
    const clamped = clampToAllowed(proposed, ALLOWED);

    if (['LoopTask','SOP','OpsIntel','SystemHealth','ControlDeck'].includes(detected)) {
      suggestions.push({ path: `${map[detected]}/`, reason: `Detected system doc (${detected}) — consider CODEX` });
    }

    return { primaryPath: clamped, suggestions, warnings, detected: { docType: detected, sopStatus: status, loopName: loop } };
  }

  if (input.target === 'runtimeCodex') {
    const base = `${VAULT}/${CODEX}`;

    if (detected === 'LoopTask') {
      if (loop) {
        const p = `${base}/Loops/${loop}/Active Tasks/${filename}`;
        return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: detected, loopName: loop } };
      }
      warnings.push('No loop detected — select a loop to place this under Loops.');
      const p = `${base}/Ops Intelligence/Training & Guides/${filename}`;
      return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: 'OpsIntel' } };
    }

    if (detected === 'SOP') {
      const folder =
        status === 'Final' ? 'Standards & SOPs/SOP Library' :
        status === 'Superseded' ? 'Standards & SOPs/Superseded & Archive' :
        'Standards & SOPs/Drafts Under Review';
      const p = `${base}/${folder}/${filename}`;
      return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: detected, sopStatus: status } };
    }

    if (detected === 'OpsIntel') {
      const p = `${base}/Ops Intelligence/Training & Guides/${filename}`;
      return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: detected } };
    }

    if (detected === 'SystemHealth') {
      const p = `${base}/System Health/Automation Logs/${todayIso()}/${filename}`; // keep dates
      return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: detected } };
    }

    if (detected === 'ControlDeck') {
      const p = `${base}/Control Deck/Admin Directives/${filename}`;
      return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: detected } };
    }

    const p = `${base}/Ops Intelligence/Training & Guides/${filename}`;
    return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: detected } };
  }

  if (input.target === 'configCodex') {
    const p = `${VAULT}/${CONFIG}/Schema Incoming/${filename}`;
    return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings, detected: { docType: 'Generic' } };
  }

  const p = `${VAULT}/UNROUTED/${filename}`;
  return { primaryPath: clampToAllowed(p, ALLOWED), suggestions, warnings: warnings.concat('Unrecognized target; using fallback.'), detected: { docType: 'Generic' } };
}

export function rethinkAllTargets(filename: string, brand?: string) {
  const candidates: RuleResult[] = [
    computePath({ target: 'runtimeCodex', filename }),
    computePath({ target: 'operationHarmony', filename, brand }),
    computePath({ target: 'configCodex', filename }),
  ];
  const primary = candidates[0];
  const others = candidates.slice(1).map(c => ({ path: c.primaryPath, reason: 'Alternate target' }));
  return { primary, others };
}
