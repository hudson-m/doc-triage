import { classifyDocument, FakeLlmClassifier } from "@doc-triage/core";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, MAX_TEXT_LENGTH } from "../src/app.ts";

// The real pipeline with the offline LLM adapter: same wiring as production, no network.
const llm = new FakeLlmClassifier();
let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp({ classify: (text) => classifyDocument(text, { llm }) });
});

afterEach(async () => {
  await app.close();
});

describe("POST /api/classify", () => {
  it("classifies a clear document with the rules", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/classify",
      payload: { text: "Form W-2 Wage and Tax Statement. Social security wages 50,000." },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ type: "w2", route: "rules" });
  });

  it("returns what was sent to the LLM, with PII masked", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/classify",
      payload: { text: "Payroll note for employee 512-44-9031, salary adjusted." },
    });

    const body = response.json<{ route: string; llm: { sentText: string } }>();
    expect(body.route).toBe("llm");
    expect(body.llm.sentText).toBe("Payroll note for employee [SSN], salary adjusted.");
  });

  it.each([
    ["missing text", {}],
    ["blank text", { text: "   " }],
    ["text over the limit", { text: "a".repeat(MAX_TEXT_LENGTH + 1) }],
  ])("rejects %s with problem details", async (_case, payload) => {
    const response = await app.inject({ method: "POST", url: "/api/classify", payload });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({ status: 400, title: "Invalid request" });
  });

  it("rejects malformed JSON as a client error", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/classify",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: 400 });
  });

  it("hides internal errors from the client", async () => {
    const failing = await buildApp({
      classify: () => Promise.reject(new Error("db password leaked")),
    });

    const response = await failing.inject({
      method: "POST",
      url: "/api/classify",
      payload: { text: "anything" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("password");
    await failing.close();
  });
});

describe("GET /health", () => {
  it("reports ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.json()).toEqual({ status: "ok" });
  });
});
