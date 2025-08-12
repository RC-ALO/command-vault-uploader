// src/app/lib/rules.ts
export type TargetKey = 'operationHarmony' | 'runtimeCodex' | 'configCodex';

export type DocType =
  | 'LoopTask'
  | 'SOP'
  | 'OpsIntel'
  | 'SystemHealth'
  | 'ControlDeck'
  | 'Operations'
  | 'Marketing'
  | 'PeopleHR'
  | 'AIAutomation'
  | 'Finance'
  | 'Strategy'
  | 'ContentCreative'
  | 'Archive'
  | 'Generic';

export type SopStatus = 'Draft' | 'Final' | 'Superseded';

export interface RuleInput {
  target: TargetKey;
  filename: string;

  // Optional hints (can be filled by the system—not the user UI)
  brand?: string;      // required when target=operationHarmony
  loopName?: string;   // used when detected LoopTask
  sopStatus?: SopStatus; // used when detected SOP
}

function sanitize(name: string) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim();
}

function ymd() {
  return new Date().toISOString().slice(0, 10);
}

// ---- Paths
const VAULT_ROOT = 'Command Vault';
const OH_ROOT = 'Operation Harmony';
const CODEX_ROOT = 'CODEX';
const CONFIG_ROOT = 'codex';

// ---- Heuristics to detect DocType from filename (very light on purpose)
function inferDocType(filename: string, target: TargetKey): DocType {
  const name = filename.toLowerCase();

  // Strong signals for system (CODEX)
  if (/(sop|standard|policy|procedure)/.test(name)) return 'SOP';
  if (/(loop|codexcard|task|ticket)/.test(name)) return 'LoopTask';
  if (/(intel|guide|training|how[- ]?to|playbook)/.test(name)) return 'OpsIntel';
  if (/(health|log|audit|report)/.test(name)) return 'SystemHealth';
  if (/(directive|governance|admin|rule)/.test(name)) return 'ControlDeck';

  // Business area signals (Operation Harmony)
  if (/(campaign|asset|brand|creative|logo|ad|social)/.test(name)) return 'Marketing';
  if (/(invoice|bill|budget|forecast|p&l|profit|loss|balance)/.test(name)) return 'Finance';
  if (/(hiring|onboard|policy|manager|hr)/.test(name)) return 'PeopleHR';
  if (/(prompt|automation|script|workflow)/.test(name)) return 'AIAutomation';
  if (/(okr|strategy|plan|review|decision)/.test(name)) return 'Strategy';
  if (/(form|checklist|process|sop)/.test(name) && target === 'operationHarmony') return 'Operations';
  if (/(content|video|blog|copy)/.test(name)) return 'ContentCreative';

  // Soft defaults to keep files OUT of Archive by default
  if (target === 'runtimeCodex') return 'OpsIntel';     // default system bucket
  if (target === 'operationHarmony') return 'Operations'; // default business bucket

  return 'Generic';
}

export interface RuleResult {
  primaryPath: string;
  suggestions: Array<{ path: string; reason: string }>;
  warnings: string[];
  detected: { docType: DocType; sopStatus?: SopStatus; loopName?: string };
}

export function computePath(input: RuleInput): RuleResult {
  const fn = sanitize(input.filename);
  const date = ymd();
  const warnings: string[] = [];
  const suggestions: Array<{ path: string; reason: string }> = [];

  // Auto-detect docType
  const detectedDocType = inferDocType(input.filename, input.target);

  // If we detect SOP/LoopTask but have no status/loop, set safe defaults
  let detectedStatus: SopStatus | undefined = input.sopStatus;
  let detectedLoop = input.loopName;

  if (detectedDocType === 'SOP' && !detectedStatus) detectedStatus = 'Draft';
  if (detectedDocType === 'LoopTask' && !detectedLoop) detectedLoop = 'Genesis_01';

  // ---- OPERATION HARMONY
  if (input.target === 'operationHarmony') {
    if (!input.brand) warnings.push('Brand is required for Operation Harmony.');
    const brand = input.brand || 'UNSPECIFIED_BRAND';
    const base = `${VAULT_ROOT}/${OH_ROOT}/${brand}`;

    // Map business areas
    const areaByType: Record<DocType, string> = {
      Operations:      `${base}/Operations/Processes & Forms`,
      Marketing:       `${base}/Marketing & Branding/Assets`,
      PeopleHR:        `${base}/People & HR/Hiring & Onboarding`,
      AIAutomation:    `${base}/AI & Automation/Prompts & Playbooks`,
      Finance:         `${base}/Finance/Reports`,
      Strategy:        `${base}/Strategy & Leadership/Plans & OKRs`,
      ContentCreative: `${base}/Content & Creative`,
      Archive:         `${base}/Archive`,
      // If someone drops system-ish files here, suggest CODEX
      LoopTask:        `${VAULT_ROOT}/${CODEX_ROOT}/Loops`,
      SOP:             `${VAULT_ROOT}/${CODEX_ROOT}/Standards & SOPs`,
      OpsIntel:        `${VAULT_ROOT}/${CODEX_ROOT}/Ops Intelligence`,
      SystemHealth:    `${VAULT_ROOT}/${CODEX_ROOT}/System Health`,
      ControlDeck:     `${VAULT_ROOT}/${CODEX_ROOT}/Control Deck`,
      Generic:         `${base}/Operations/Processes & Forms`,
    };

    const area = areaByType[detectedDocType];
    let primaryPath = `${area}/${date}/${fn}`;

    // Suggest move to CODEX if the detector says it's a system file
    if (['LoopTask', 'SOP', 'OpsIntel', 'SystemHealth', 'ControlDeck'].includes(detectedDocType)) {
      suggestions.push({
        path: `${areaByType[detectedDocType]}/`,
        reason: `Detected a system doc (“${detectedDocType}”). Consider routing to CODEX.`,
      });
    }

    return {
      primaryPath,
      suggestions,
      warnings,
      detected: { docType: detectedDocType, sopStatus: detectedStatus, loopName: detectedLoop },
    };
  }

  // ---- CODEX (runtime)
  if (input.target === 'runtimeCodex') {
    const base = `${VAULT_ROOT}/${CODEX_ROOT}`;

    if (detectedDocType === 'LoopTask') {
      const loop = detectedLoop || 'Genesis_01';
      const primaryPath = `${base}/Loops/${loop}/Active Tasks/${date}/${fn}`;
      return {
        primaryPath,
        suggestions,
        warnings,
        detected: { docType: detectedDocType, loopName: loop },
      };
    }

    if (detectedDocType === 'SOP') {
      const status = detectedStatus || 'Draft';
      const folder =
        status === 'Final'
          ? 'Standards & SOPs/SOP Library'
          : status === 'Superseded'
          ? 'Standards & SOPs/Superseded & Archive'
          : 'Standards & SOPs/Drafts Under Review';
      const primaryPath = `${base}/${folder}/${date}/${fn}`;
      return {
        primaryPath,
        suggestions,
        warnings,
        detected: { docType: detectedDocType, sopStatus: status },
      };
    }

    if (detectedDocType === 'OpsIntel') {
      const primaryPath = `${base}/Ops Intelligence/Training & Guides/${date}/${fn}`;
      return { primaryPath, suggestions, warnings, detected: { docType: detectedDocType } };
    }

    if (detectedDocType === 'SystemHealth') {
      const primaryPath = `${base}/System Health/Automation Logs/${date}/${fn}`;
      return { primaryPath, suggestions, warnings, detected: { docType: detectedDocType } };
    }

    if (detectedDocType === 'ControlDeck') {
      const primaryPath = `${base}/Control Deck/Admin Directives/${date}/${fn}`;
      return { primaryPath, suggestions, warnings, detected: { docType: detectedDocType } };
    }

    // Default for unknown system docs -> Training & Guides (not Archive)
    const primaryPath = `${base}/Ops Intelligence/Training & Guides/${date}/${fn}`;
    return { primaryPath, suggestions, warnings, detected: { docType: detectedDocType } };
  }

  // ---- codex (config) — always ingress to validation area
  if (input.target === 'configCodex') {
    const primaryPath = `${VAULT_ROOT}/${CONFIG_ROOT}/Schema Incoming/${date}/${fn}`;
    return { primaryPath, suggestions, warnings, detected: { docType: 'Generic' } };
  }

  // Fallback
  return {
    primaryPath: `${VAULT_ROOT}/UNROUTED/${date}/${fn}`,
    suggestions,
    warnings: warnings.concat('Unrecognized target; using fallback.'),
    detected: { docType: 'Generic' },
  };
}

/**
 * Deep re-evaluation across ALL targets.
 * Returns the top candidate (by heuristic priority) and other suggestions.
 */
export function rethinkAllTargets(filename: string, brand?: string) {
  const candidates: RuleResult[] = [
    computePath({ target: 'runtimeCodex', filename }),
    computePath({ target: 'operationHarmony', filename, brand }),
    computePath({ target: 'configCodex', filename }),
  ];
  // Naive priority: CODEX > Operation Harmony > codex (config)
  const primary = candidates[0];
  const others = candidates.slice(1).map((c) => ({ path: c.primaryPath, reason: 'Alternate target' }));
  return { primary, others };
}

