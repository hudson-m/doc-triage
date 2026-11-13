import type { DocumentType } from "./document-types.ts";
import type { LlmClassifier, LlmVerdict } from "./llm.ts";
import { maskPii, type PiiKind } from "./pii.ts";
import { costUsd } from "./pricing.ts";
import { applyRules } from "./rules.ts";

export type Route = "rules" | "llm" | "manual_review";

export interface LlmCallInfo {
  readonly model: string;
  /** Exactly what left the process: the masked text. Shown in the UI for transparency. */
  readonly sentText: string;
  readonly piiMasked: Readonly<Record<PiiKind, number>>;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

export interface ClassificationResult {
  readonly type: DocumentType;
  readonly confidence: number;
  readonly route: Route;
  readonly reasons: readonly string[];
  /** Present only when the LLM was called. */
  readonly llm?: LlmCallInfo;
}

export interface PipelineDeps {
  readonly llm: LlmClassifier;
  /** LLM answers below this confidence go to a person instead of being trusted. */
  readonly minLlmConfidence?: number;
}

export const DEFAULT_MIN_LLM_CONFIDENCE = 0.5;

/**
 * Rules first, LLM second, a person last.
 * Rules are free, deterministic and auditable, so they take the clear-cut documents.
 * Only ambiguous documents reach the LLM, and only after PII masking.
 */
export async function classifyDocument(
  text: string,
  deps: PipelineDeps,
  signal?: AbortSignal,
): Promise<ClassificationResult> {
  const rules = applyRules(text);
  if (rules.type) {
    return {
      type: rules.type,
      confidence: rules.confidence,
      route: "rules",
      reasons: rules.matched,
    };
  }

  const { masked, found } = maskPii(text);
  let verdict: LlmVerdict;
  try {
    verdict = await deps.llm.classify(masked, signal);
  } catch (error) {
    return manualReview([...rules.matched, `LLM call failed: ${describe(error)}`]);
  }

  const llm: LlmCallInfo = {
    model: deps.llm.model,
    sentText: masked,
    piiMasked: found,
    inputTokens: verdict.usage.inputTokens,
    outputTokens: verdict.usage.outputTokens,
    costUsd: costUsd(deps.llm.model, verdict.usage),
  };

  if (verdict.kind === "refused") {
    return manualReview([...rules.matched, "LLM declined to classify"], llm);
  }
  const threshold = deps.minLlmConfidence ?? DEFAULT_MIN_LLM_CONFIDENCE;
  if (verdict.confidence < threshold) {
    return manualReview(
      [...rules.matched, `LLM confidence ${verdict.confidence} is below ${threshold}`],
      llm,
    );
  }
  return {
    type: verdict.type,
    confidence: verdict.confidence,
    route: "llm",
    reasons: [...rules.matched, `LLM (${deps.llm.model}) decided`],
    llm,
  };
}

function manualReview(reasons: string[], llm?: LlmCallInfo): ClassificationResult {
  const base = { type: "other" as const, confidence: 0, route: "manual_review" as const, reasons };
  return llm ? { ...base, llm } : base;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
