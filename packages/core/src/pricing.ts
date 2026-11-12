import type { TokenUsage } from "./llm.ts";

interface Rate {
  /** USD per million input tokens. */
  readonly input: number;
  /** USD per million output tokens. */
  readonly output: number;
}

interface Price extends Rate {
  /** A different rate for the whole request once the prompt exceeds `aboveInputTokens`. */
  readonly longPrompt?: Rate & { readonly aboveInputTokens: number };
}

/** USD per million tokens, from the public price list. Update when prices change. */
export const PRICES: Readonly<Record<string, Price>> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    longPrompt: { aboveInputTokens: 100_000, input: 0.5, output: 2.5 },
  },
};

/** Returns 0 for an unknown model rather than guessing a price. */
export function costUsd(model: string, usage: TokenUsage): number {
  const price = PRICES[model];
  if (!price) return 0;
  const rate =
    price.longPrompt && usage.inputTokens > price.longPrompt.aboveInputTokens
      ? price.longPrompt
      : price;
  return (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1_000_000;
}
