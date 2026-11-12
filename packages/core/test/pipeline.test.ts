import { describe, expect, it, vi } from "vitest";
import type { LlmClassifier, LlmVerdict } from "../src/llm.ts";
import { classifyDocument } from "../src/pipeline.ts";

const CLEAR_PAY_STUB =
  "Earnings Statement. Gross pay $4,000. Net pay $3,100. Pay period 01/01-01/15.";
const AMBIGUOUS = "Payroll summary for employee SSN 123-45-6789, contact jane@example.com.";

function llmReturning(verdict: LlmVerdict): LlmClassifier & { calls: string[] } {
  const calls: string[] = [];
  return {
    model: "claude-opus-5-5",
    calls,
    classify: (text) => {
      calls.push(text);
      return Promise.resolve(verdict);
    },
  };
}

const usage = { inputTokens: 1_000, outputTokens: 100 };

describe("classifyDocument", () => {
  it("never calls the LLM when the rules decide", async () => {
    const llm = llmReturning({ kind: "classified", type: "w2", confidence: 0.9, usage });

    const result = await classifyDocument(CLEAR_PAY_STUB, { llm });

    expect(result).toMatchObject({ type: "pay_stub", route: "rules" });
    expect(result.llm).toBeUndefined();
    expect(llm.calls).toHaveLength(0);
  });

  it("sends only masked text to the LLM", async () => {
    const llm = llmReturning({ kind: "classified", type: "pay_stub", confidence: 0.8, usage });

    const result = await classifyDocument(AMBIGUOUS, { llm });

    expect(llm.calls).toEqual(["Payroll summary for employee SSN [SSN], contact [EMAIL]."]);
    expect(llm.calls[0]).not.toContain("123-45-6789");
    expect(result).toMatchObject({ type: "pay_stub", route: "llm", confidence: 0.8 });
    expect(result.llm?.piiMasked).toMatchObject({ ssn: 1, email: 1 });
  });

  it("reports the cost of the LLM call", async () => {
    const llm = llmReturning({ kind: "classified", type: "pay_stub", confidence: 0.8, usage });

    const result = await classifyDocument(AMBIGUOUS, { llm });

    // 1,000 input tokens at $4/M + 100 output tokens at $20/M
    expect(result.llm?.costUsd).toBeCloseTo(0.006, 6);
  });

  it("sends low-confidence LLM answers to a person", async () => {
    const llm = llmReturning({ kind: "classified", type: "w2", confidence: 0.3, usage });

    const result = await classifyDocument(AMBIGUOUS, { llm, minLlmConfidence: 0.5 });

    expect(result).toMatchObject({ type: "other", route: "manual_review" });
    expect(result.llm?.inputTokens).toBe(1_000);
  });

  it("sends refusals to a person", async () => {
    const llm = llmReturning({ kind: "refused", usage });

    const result = await classifyDocument(AMBIGUOUS, { llm });

    expect(result.route).toBe("manual_review");
    expect(result.reasons).toContain("LLM declined to classify");
  });

  it("degrades to manual review when the LLM is down", async () => {
    const llm: LlmClassifier = {
      model: "claude-opus-5-5",
      classify: vi.fn().mockRejectedValue(new Error("timeout")),
    };

    const result = await classifyDocument(AMBIGUOUS, { llm });

    expect(result).toMatchObject({ route: "manual_review", type: "other" });
    expect(result.reasons).toContain("LLM call failed: timeout");
  });
});
