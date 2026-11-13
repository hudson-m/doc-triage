import { describe, expect, it } from "vitest";
import { applyRules } from "../src/rules.ts";

describe("applyRules", () => {
  it("decides a clear pay stub on its own", () => {
    const verdict = applyRules(
      "ACME Corp Earnings Statement. Pay period 01/01-01/15. Gross pay $4,000.00. Net pay $3,120.55. YTD totals.",
    );

    expect(verdict.type).toBe("pay_stub");
    expect(verdict.confidence).toBe(1);
    expect(verdict.matched).toContain('pay_stub: "Gross pay"');
  });

  it("decides a clear bank statement on its own", () => {
    const verdict = applyRules(
      "First Bank account statement. Beginning balance $1,000. Deposits $500. Ending balance $1,500.",
    );

    expect(verdict.type).toBe("bank_statement");
  });

  it("abstains when the evidence is too weak", () => {
    const verdict = applyRules("Monthly summary. Deposits were made. Amount due next week.");

    expect(verdict.type).toBeUndefined();
  });

  it("abstains when two types compete", () => {
    // A pay stub that also quotes a bank balance: strong signals on both sides.
    const verdict = applyRules(
      "Gross pay $4,000. Net pay $3,000. Deposited to checking account. Ending balance $9,000.",
    );

    expect(verdict.type).toBeUndefined();
    expect(verdict.scores.pay_stub).toBeGreaterThan(0);
    expect(verdict.scores.bank_statement).toBeGreaterThan(0);
  });

  it("reports zero confidence for text with no signals", () => {
    const verdict = applyRules("Hello world");

    expect(verdict).toMatchObject({ type: undefined, confidence: 0, matched: [] });
  });
});
