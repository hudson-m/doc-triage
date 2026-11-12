import type { DocumentType } from "./document-types.ts";

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type LlmVerdict =
  | {
      readonly kind: "classified";
      readonly type: DocumentType;
      readonly confidence: number;
      readonly usage: TokenUsage;
    }
  | { readonly kind: "refused"; readonly usage: TokenUsage };

/**
 * Port for the LLM fallback. It only ever receives masked text: the pipeline guarantees that,
 * and a test asserts it. Adapters (Anthropic, fake) are chosen by the app at startup.
 */
export interface LlmClassifier {
  readonly model: string;
  classify(maskedText: string, signal?: AbortSignal): Promise<LlmVerdict>;
}
