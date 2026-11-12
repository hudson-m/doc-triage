import type { DocumentType } from "./document-types.ts";

/** A strong signal is almost unique to one document type; a weak one only hints at it. */
const STRONG = 3;
const WEAK = 1;

interface Signal {
  readonly pattern: RegExp;
  readonly weight: number;
}

export type RuleType = Exclude<DocumentType, "other">;

const SIGNALS: Readonly<Record<RuleType, readonly Signal[]>> = {
  pay_stub: [
    { pattern: /\b(earnings statement|pay stub|paystub)\b/i, weight: STRONG },
    { pattern: /\bgross pay\b/i, weight: STRONG },
    { pattern: /\bnet pay\b/i, weight: STRONG },
    { pattern: /\b(pay period|pay date)\b/i, weight: WEAK },
    { pattern: /\b(ytd|year to date)\b/i, weight: WEAK },
    { pattern: /\b(deductions?|withholding)\b/i, weight: WEAK },
  ],
  bank_statement: [
    { pattern: /\b(account statement|bank statement|statement of account)\b/i, weight: STRONG },
    { pattern: /\b(beginning|opening) balance\b/i, weight: STRONG },
    { pattern: /\b(ending|closing) balance\b/i, weight: STRONG },
    { pattern: /\b(deposits?|withdrawals?)\b/i, weight: WEAK },
    { pattern: /\b(checking|savings) account\b/i, weight: WEAK },
  ],
  w2: [
    { pattern: /\bform w-?2\b/i, weight: STRONG },
    { pattern: /\bwage and tax statement\b/i, weight: STRONG },
    { pattern: /\b(social security wages|medicare wages)\b/i, weight: STRONG },
    { pattern: /\bemployer identification number\b/i, weight: WEAK },
    { pattern: /\bfederal income tax withheld\b/i, weight: WEAK },
  ],
  utility_bill: [
    { pattern: /\b(kwh|kilowatt[- ]hours?)\b/i, weight: STRONG },
    { pattern: /\b(meter reading|meter number)\b/i, weight: STRONG },
    {
      pattern: /\b(electric|electricity|water|gas|sewer) (service|usage|charges)\b/i,
      weight: WEAK,
    },
    { pattern: /\b(service address|amount due|due date)\b/i, weight: WEAK },
  ],
};

/** Rules decide only with a clear winner; anything less goes to the LLM. */
export const RULES_MIN_SCORE = 6;
export const RULES_MIN_MARGIN = 4;

export interface RulesVerdict {
  /** Undefined when the rules are not confident enough to decide. */
  readonly type: RuleType | undefined;
  /** Share of the evidence held by the best type, from 0 to 1. */
  readonly confidence: number;
  readonly scores: Readonly<Record<RuleType, number>>;
  readonly matched: readonly string[];
}

export function applyRules(text: string): RulesVerdict {
  const scores: Record<RuleType, number> = {
    pay_stub: 0,
    bank_statement: 0,
    w2: 0,
    utility_bill: 0,
  };
  const matched: string[] = [];

  for (const [type, signals] of Object.entries(SIGNALS) as [RuleType, readonly Signal[]][]) {
    for (const { pattern, weight } of signals) {
      const hit = pattern.exec(text);
      if (hit) {
        scores[type] += weight;
        matched.push(`${type}: "${hit[0]}"`);
      }
    }
  }

  const ranked = (Object.entries(scores) as [RuleType, number][]).sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = ranked[0] ?? ["pay_stub", 0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const total = ranked.reduce((sum, [, score]) => sum + score, 0);
  const decided = bestScore >= RULES_MIN_SCORE && bestScore - secondScore >= RULES_MIN_MARGIN;

  return {
    type: decided ? bestType : undefined,
    confidence: total === 0 ? 0 : Math.round((bestScore / total) * 100) / 100,
    scores,
    matched,
  };
}
