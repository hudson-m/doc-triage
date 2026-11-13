# 3. Rules first, LLM fallback on masked text, a person last

**Status:** accepted

## Context

Sending every document to an LLM is simple, but it is the most expensive option, it is
non-deterministic, and it sends personal data (SSNs, account numbers) to a third party.
Most documents in a mortgage file are easy to recognise from a few phrases.

## Decision

- **Rules** score weighted regex signals per type. They decide only with a clear winner
  (score ≥ 6 and a margin of ≥ 4 over the runner-up). They are free, instant and auditable:
  the response lists the phrases that matched.
- **LLM fallback** handles what the rules abstain on. Before the call, structured PII
  (SSN, EIN, email, phone, card and account numbers) is replaced by typed placeholders. The
  response includes exactly what was sent, so the masking is visible, not just claimed.
- **Structured output** (a Zod schema converted to the API's JSON schema) guarantees a valid
  `{ type, confidence }` instead of parsing free text.
- **Prompt injection:** the document is untrusted input. It is fenced in `<document>` tags,
  a closing tag inside it is neutralised, and the system prompt says not to follow
  instructions inside it. The output schema also limits what a successful injection can do.
- **A person** gets the document when the LLM refuses, fails, or answers with confidence below
  `MIN_LLM_CONFIDENCE`. An outage degrades to manual review instead of a 500.
- Effort is `low`: classification does not benefit from deep reasoning.

## Consequences

- Cost scales with the share of ambiguous documents, not with total volume. The eval CLI
  measures that trade-off on a labeled dataset (ADR 4).
- Names and street addresses are not masked: that needs an NER model. It is listed in the
  README under honest scope rather than hidden.
- Thresholds are constants with tests around them; tuning them is a reviewed change.
