import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FakeLlmClassifier, type LlmClassifier } from "@doc-triage/core";
import { describe, expect, it } from "vitest";
import { evaluate, parseDataset, parseMinAccuracy, resolveDatasetPath } from "../src/evaluate.ts";

const datasetUrl = new URL("../../../dataset/labeled.jsonl", import.meta.url);

describe("parseMinAccuracy", () => {
  it("is optional", () => {
    expect(parseMinAccuracy(undefined)).toBeUndefined();
  });

  it.each([
    ["1", 1],
    ["0.95", 0.95],
    ["0", 0],
  ])("accepts %s", (value, expected) => {
    expect(parseMinAccuracy(value)).toBe(expected);
  });

  // Each of these used to disable the CI gate silently (NaN or 0).
  it.each(["abc", "", "  ", "1.5", "-0.1", "NaN"])("rejects %j", (value) => {
    expect(() => parseMinAccuracy(value)).toThrow(/between 0 and 1/);
  });
});

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

  it("keeps evaluating when LLM calls fail, and reports each failed baseline", async () => {
    const docs = parseDataset(await readFile(datasetUrl, "utf8"));
    const failing: LlmClassifier = {
      model: "claude-opus-5-5",
      classify: () => Promise.reject(new Error("429 rate limited")),
    };

    const report = await evaluate(docs, failing, 0.5);

    // Every document still went through the pipeline: rules decide, the rest go to a person.
    expect(report.total).toBe(docs.length);
    expect(report.byRoute.llm.count).toBe(0);
    expect(report.byRoute.rules.count + report.byRoute.manual_review.count).toBe(docs.length);
    // Every baseline call failed, was recorded, and cost nothing.
    expect(report.baselineFailures).toHaveLength(docs.length);
    expect(report.baselineFailures[0]).toEqual({ id: docs[0]?.id, reason: "429 rate limited" });
    expect(report.llmOnlyCostUsd).toBe(0);
    expect(report.llmOnlyAccuracy).toBe(0);
  });

  it("resolves a dataset name inside the dataset folder", () => {
    const dir = resolve("dataset");

    expect(resolveDatasetPath("labeled.jsonl", dir)).toBe(join(dir, "labeled.jsonl"));
  });

  it.each(["../package.json", "../../.env.jsonl", "/etc/passwd", "labeled.txt"])(
    "refuses %s (path traversal or wrong file type)",
    (name) => {
      expect(() => resolveDatasetPath(name, resolve("dataset"))).toThrow(/inside/);
    },
  );

  it("rejects a dataset line with an unknown label", () => {
    expect(() => parseDataset('{"id":"x","label":"invoice","text":"t"}')).toThrow(/line 1/);
  });
});
