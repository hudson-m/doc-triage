import {
  classifyDocument,
  costUsd,
  DOCUMENT_TYPES,
  maskPii,
  type LlmClassifier,
  type Route,
} from "@doc-triage/core";
import { extname, resolve, sep } from "node:path";
import { z } from "zod";

/**
 * Resolves a dataset name given on the command line to a .jsonl file inside `datasetDir`.
 * CLI arguments are untrusted input: without this check, `--dataset ../../.env` would read
 * any file the process can reach (path traversal).
 */
export function resolveDatasetPath(name: string, datasetDir: string): string {
  const root = resolve(datasetDir);
  const fullPath = resolve(root, name);
  if (!fullPath.startsWith(root + sep) || extname(fullPath) !== ".jsonl") {
    throw new Error(`Dataset must be a .jsonl file inside ${root}`);
  }
  return fullPath;
}

export const LabeledDocSchema = z.object({
  id: z.string().min(1),
  label: z.enum(DOCUMENT_TYPES),
  text: z.string().min(1),
});
export type LabeledDoc = z.infer<typeof LabeledDocSchema>;

export interface RouteStats {
  count: number;
  correct: number;
}

export interface EvalReport {
  readonly total: number;
  /** Share of documents decided without a person (rules or LLM). */
  readonly coverage: number;
  /** Accuracy over the documents that were decided automatically. */
  readonly accuracy: number;
  readonly byRoute: Readonly<Record<Route, RouteStats>>;
  readonly hybridCostUsd: number;
  /** What the same documents cost if every one went to the LLM. */
  readonly llmOnlyCostUsd: number;
  readonly llmOnlyAccuracy: number;
  readonly errors: readonly { id: string; expected: string; actual: string; route: Route }[];
}

export function parseDataset(jsonl: string): LabeledDoc[] {
  return jsonl
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      const parsed = LabeledDocSchema.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`Dataset line ${index + 1}: ${parsed.error.message}`);
      return parsed.data;
    });
}

/** Runs the real pipeline over a labeled dataset and compares it with an LLM-only baseline. */
export async function evaluate(
  docs: readonly LabeledDoc[],
  llm: LlmClassifier,
  minLlmConfidence: number,
): Promise<EvalReport> {
  const byRoute: Record<Route, RouteStats> = {
    rules: { count: 0, correct: 0 },
    llm: { count: 0, correct: 0 },
    manual_review: { count: 0, correct: 0 },
  };
  const errors: EvalReport["errors"][number][] = [];
  let hybridCostUsd = 0;
  let llmOnlyCostUsd = 0;
  let llmOnlyCorrect = 0;

  for (const doc of docs) {
    const result = await classifyDocument(doc.text, { llm, minLlmConfidence });
    const stats = byRoute[result.route];
    stats.count += 1;
    hybridCostUsd += result.llm?.costUsd ?? 0;
    if (result.route !== "manual_review") {
      if (result.type === doc.label) stats.correct += 1;
      else
        errors.push({ id: doc.id, expected: doc.label, actual: result.type, route: result.route });
    }

    // Baseline: the same document sent straight to the LLM (still masked).
    const baseline = await llm.classify(maskPii(doc.text).masked);
    llmOnlyCostUsd += costUsd(llm.model, baseline.usage);
    if (baseline.kind === "classified" && baseline.type === doc.label) llmOnlyCorrect += 1;
  }

  const decided = byRoute.rules.count + byRoute.llm.count;
  const correct = byRoute.rules.correct + byRoute.llm.correct;
  return {
    total: docs.length,
    coverage: ratio(decided, docs.length),
    accuracy: ratio(correct, decided),
    byRoute,
    hybridCostUsd,
    llmOnlyCostUsd,
    llmOnlyAccuracy: ratio(llmOnlyCorrect, docs.length),
    errors,
  };
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}
