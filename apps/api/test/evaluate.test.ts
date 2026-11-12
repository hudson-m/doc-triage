import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FakeLlmClassifier } from "@doc-triage/core";
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
