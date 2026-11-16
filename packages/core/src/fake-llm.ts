import type { DocumentType } from "./document-types.ts";
import type { LlmClassifier, LlmVerdict } from "./llm.ts";

const HINTS: readonly (readonly [DocumentType, RegExp])[] = [
  ["w2", /\b(w-?2|tax year|withheld)\b/i],
  ["utility_bill", /\b(utility|meter|kwh|service period|power|energy|gallons)\b/i],
  ["pay_stub", /\b(salary|wages|employee|payroll|hours worked|overtime)\b/i],
  ["bank_statement", /\b(balance|deposit|withdrawal|transaction|bank)\b/i],
];

/**
 * Deterministic stand-in for an LLM, so the app, tests and CI run offline at zero cost.
 * It estimates token usage the way a real call is billed (about 4 characters per token, plus
 * the prompt), so cost reports stay comparable. Its accuracy says nothing about a real model.
 */
export class FakeLlmClassifier implements LlmClassifier {
  readonly model: string;

  constructor(model = "claude-opus-5-5") {
    this.model = model;
  }

  classify(maskedText: string): Promise<LlmVerdict> {
    const usage = { inputTokens: Math.ceil(maskedText.length / 4) + 250, outputTokens: 20 };
    const hit = HINTS.find(([, pattern]) => pattern.test(maskedText));
    return Promise.resolve({
      kind: "classified",
      type: hit ? hit[0] : "other",
      confidence: hit ? 0.7 : 0.6,
      usage,
    });
  }
}
