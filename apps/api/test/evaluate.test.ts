import { readFile } from "node:fs/promises";
import { FakeLlmClassifier } from "@doc-triage/core";
import { describe, expect, it } from "vitest";
import { evaluate, parseDataset } from "../src/evaluate.ts";

const datasetUrl = new URL("../../../dataset/labeled.jsonl", import.meta.url);

describe("evaluate", () => {
  it("never lets the rules misclassify a labeled document", async () => {
    const docs = parseDataset(await readFile(datasetUrl, "utf8"));

    const report = await evaluate(docs, new FakeLlmClassifier(), 0.5);

    expect(report.total).toBe(docs.length);
    expect(report.byRoute.rules.count).toBeGreaterThan(0);
    expect(report.byRoute.rules.correct).toBe(report.byRoute.rules.count);
  });

  it("costs less than sending every document to the LLM", async () => {
    const docs = parseDataset(await readFile(datasetUrl, "utf8"));

    const report = await evaluate(docs, new FakeLlmClassifier(), 0.5);

    expect(report.hybridCostUsd).toBeLessThan(report.llmOnlyCostUsd);
  });

  it("rejects a dataset line with an unknown label", () => {
    expect(() => parseDataset('{"id":"x","label":"invoice","text":"t"}')).toThrow(/line 1/);
  });
});
