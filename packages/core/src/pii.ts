export const PII_KINDS = ["ssn", "ein", "email", "card", "phone", "account"] as const;
export type PiiKind = (typeof PII_KINDS)[number];

// Order matters: specific formats run first, so a generic digit run never swallows an SSN.
const PATTERNS: readonly (readonly [PiiKind, RegExp])[] = [
  ["ssn", /\b\d{3}-\d{2}-\d{4}\b/g],
  ["ein", /\b\d{2}-\d{7}\b/g],
  ["email", /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g],
  ["card", /\b(?:\d{4}[ -]){3}\d{4}\b/g],
  // "(212) 555-0199", "(212)555-0199", "212-555-0199", "212.555.0199", "+1 212 555 0199"
  ["phone", /(?:\+1[ .-]?)?(?:\(\d{3}\)[ .-]?|\b\d{3}[ .-])\d{3}[ .-]\d{4}\b/g],
  ["account", /\b\d{8,17}\b/g],
];

export interface MaskResult {
  readonly masked: string;
  readonly found: Readonly<Record<PiiKind, number>>;
}

/**
 * Replaces structured PII with typed placeholders such as [SSN] before text leaves the process.
 * Names and street addresses are NOT detected: that needs an NER model (see README, honest scope).
 */
export function maskPii(text: string): MaskResult {
  const found: Record<PiiKind, number> = {
    ssn: 0,
    ein: 0,
    email: 0,
    card: 0,
    phone: 0,
    account: 0,
  };
  let masked = text;
  for (const [kind, pattern] of PATTERNS) {
    masked = masked.replace(pattern, () => {
      found[kind] += 1;
      return `[${kind.toUpperCase()}]`;
    });
  }
  return { masked, found };
}
