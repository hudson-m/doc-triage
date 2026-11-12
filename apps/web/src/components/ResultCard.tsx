import type { ClassificationResult, Route } from "@doc-triage/core";

const ROUTE_LABEL: Record<Route, string> = {
  rules: "Decided by rules (no LLM call, no cost)",
  llm: "Decided by the LLM fallback",
  manual_review: "Sent to manual review",
};

export function ResultCard({ result }: { readonly result: ClassificationResult }) {
  const masked = result.llm
    ? Object.entries(result.llm.piiMasked).filter(([, count]) => count > 0)
    : [];

  return (
    <section aria-label="Result" className={`result route-${result.route}`}>
      <h2>
        <span data-testid="doc-type">{result.type.replace("_", " ")}</span>
        <small>{Math.round(result.confidence * 100)}% confidence</small>
      </h2>
      <p className="route" data-testid="route">
        {ROUTE_LABEL[result.route]}
      </p>

      {result.reasons.length > 0 && (
        <details>
          <summary>Why</summary>
          <ul>
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      )}

      {result.llm && (
        <div className="llm">
          <p>
            {result.llm.model}: {result.llm.inputTokens} input + {result.llm.outputTokens} output
            tokens, ${result.llm.costUsd.toFixed(5)}
          </p>
          <p>
            Masked before sending:{" "}
            {masked.length === 0
              ? "nothing found"
              : masked.map(([kind, count]) => `${kind} ×${count}`).join(", ")}
          </p>
          <h3>Exactly what the LLM received</h3>
          <pre data-testid="sent-text">{result.llm.sentText}</pre>
        </div>
      )}
    </section>
  );
}
