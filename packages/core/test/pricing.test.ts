import { describe, expect, it } from "vitest";
import { costUsd } from "../src/pricing.ts";

describe("costUsd", () => {
  it("prices input and output tokens per million", () => {
    // 1,000 input tokens at $4/M + 100 output tokens at $20/M
    expect(costUsd("claude-opus-5-5", { inputTokens: 1_000, outputTokens: 100 })).toBeCloseTo(
      0.006,
      9,
    );
  });

  it("uses the standard Haiku rate up to 100,000 input tokens", () => {
    expect(costUsd("claude-haiku-5-5", { inputTokens: 100_000, outputTokens: 1_000 })).toBeCloseTo(
      (100_000 * 0.1 + 1_000 * 0.5) / 1_000_000,
      9,
    );
  });

  it("uses the long-prompt Haiku rate above 100,000 input tokens", () => {
    expect(costUsd("claude-haiku-5-5", { inputTokens: 100_001, outputTokens: 1_000 })).toBeCloseTo(
      (100_001 * 0.5 + 1_000 * 2.5) / 1_000_000,
      9,
    );
  });

  it("returns 0 for an unknown model instead of guessing", () => {
    expect(costUsd("some-other-model", { inputTokens: 1_000, outputTokens: 1_000 })).toBe(0);
  });
});
