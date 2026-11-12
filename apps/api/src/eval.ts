import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { loadConfig } from "./config.ts";
import { evaluate, parseDataset, type EvalReport } from "./evaluate.ts";
import { createLlmClassifier } from "./llm-factory.ts";

// Usage: npm run eval -- [--dataset dataset/labeled.jsonl] [--min-rules-accuracy 1]
// The provider comes from LLM_PROVIDER, like the server. With "anthropic" this spends real tokens.
const { values } = parseArgs({
  options: {
    dataset: { type: "string", default: "dataset/labeled.jsonl" },
    "min-rules-accuracy": { type: "string" },
  },
});

const config = loadConfig(process.env);
const llm = createLlmClassifier(config);
const docs = parseDataset(await readFile(values.dataset, "utf8"));
const report = await evaluate(docs, llm, config.MIN_LLM_CONFIDENCE);

print(report, config.LLM_PROVIDER, llm.model);

// CI gate: the rules are deterministic, so their accuracy must not regress.
const minRules = values["min-rules-accuracy"];
if (minRules !== undefined) {
  const { count, correct } = report.byRoute.rules;
  const rulesAccuracy = count === 0 ? 0 : correct / count;
  if (rulesAccuracy < Number(minRules)) {
    console.error(`\nFAIL: rules accuracy ${pct(rulesAccuracy)} is below ${pct(Number(minRules))}`);
    process.exitCode = 1;
  }
}

function print(r: EvalReport, provider: string, model: string): void {
  const usd = (n: number) => `$${n.toFixed(5)}`;
  console.log(`Dataset: ${values.dataset} (${r.total} documents)  LLM: ${provider} / ${model}\n`);
  console.table(
    Object.fromEntries(
      Object.entries(r.byRoute).map(([route, s]) => [
        route,
        { documents: s.count, correct: route === "manual_review" ? "-" : s.correct },
      ]),
    ),
  );
  console.log(`Coverage (decided without a person): ${pct(r.coverage)}`);
  console.log(`Accuracy on decided documents:       ${pct(r.accuracy)}`);
  console.log(`LLM-only accuracy (baseline):        ${pct(r.llmOnlyAccuracy)}`);
  console.log(`Cost, rules + LLM fallback:          ${usd(r.hybridCostUsd)}`);
  console.log(`Cost, LLM for every document:        ${usd(r.llmOnlyCostUsd)}`);
  if (r.hybridCostUsd > 0) {
    console.log(
      `Cost reduction:                      ${(r.llmOnlyCostUsd / r.hybridCostUsd).toFixed(1)}x`,
    );
  }
  if (provider === "fake") {
    console.log(
      "\nNote: the fake LLM is a keyword stand-in. Costs are estimated from token counts;",
    );
    console.log("LLM accuracy is only meaningful with LLM_PROVIDER=anthropic.");
  }
  if (r.errors.length > 0) {
    console.log("\nMisclassified:");
    console.table(r.errors);
  }
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
