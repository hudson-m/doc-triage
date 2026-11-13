import { describe, expect, it } from "vitest";
import { maskPii } from "../src/pii.ts";

describe("maskPii", () => {
  it("replaces each kind of structured PII with a typed placeholder", () => {
    const { masked, found } = maskPii(
      [
        "SSN 123-45-6789",
        "EIN 12-3456789",
        "mail jane.doe+bank@example.co.uk",
        "card 4111 1111 1111 1111",
        "phone (415) 555-0134",
        "account 000123456789",
      ].join("\n"),
    );

    expect(masked).toBe(
      [
        "SSN [SSN]",
        "EIN [EIN]",
        "mail [EMAIL]",
        "card [CARD]",
        "phone [PHONE]",
        "account [ACCOUNT]",
      ].join("\n"),
    );
    expect(found).toEqual({ ssn: 1, ein: 1, email: 1, card: 1, phone: 1, account: 1 });
  });

  it.each(["(212) 555-0199", "(212)555-0199", "212-555-0199", "212.555.0199", "+1 212 555 0199"])(
    "masks the phone format %s",
    (phone) => {
      expect(maskPii(`Call ${phone} today`).masked).toBe("Call [PHONE] today");
    },
  );

  it("keeps the words and amounts the classifier needs", () => {
    const text = "Gross pay $4,250.00 on 2026-01-15, 80 hours, invoice 4521";

    expect(maskPii(text).masked).toBe(text);
  });

  it("counts repeated values", () => {
    expect(maskPii("123-45-6789 and again 987-65-4321").found.ssn).toBe(2);
  });
});
