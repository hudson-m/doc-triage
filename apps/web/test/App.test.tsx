import type { ClassificationResult } from "@doc-triage/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const llmResult: ClassificationResult = {
  type: "pay_stub",
  confidence: 0.7,
  route: "llm",
  reasons: ["LLM (claude-opus-5-5) decided"],
  llm: {
    model: "claude-opus-5-5",
    sentText: "Payroll note for [SSN]",
    piiMasked: { ssn: 1, ein: 0, email: 0, card: 0, phone: 0, account: 0 },
    inputTokens: 263,
    outputTokens: 20,
    costUsd: 0.001452,
  },
};

describe("App", () => {
  it("disables submit until there is text", async () => {
    render(<App />);
    const submit = screen.getByRole("button", { name: "Classify" });

    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Document text"), "hello");
    expect(submit).toBeEnabled();
  });

  it("posts the text and shows what the LLM received", async () => {
    const fetchMock = stubFetch(200, llmResult);
    render(<App />);

    await userEvent.type(screen.getByLabelText("Document text"), "Payroll note for 512-44-9031");
    await userEvent.click(screen.getByRole("button", { name: "Classify" }));

    expect(await screen.findByTestId("doc-type")).toHaveTextContent("pay stub");
    expect(screen.getByTestId("route")).toHaveTextContent("LLM fallback");
    expect(screen.getByTestId("sent-text")).toHaveTextContent("Payroll note for [SSN]");
    expect(screen.getByText(/ssn ×1/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/classify",
      expect.objectContaining({ body: JSON.stringify({ text: "Payroll note for 512-44-9031" }) }),
    );
  });

  it("fills the form from a sample", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Clear pay stub" }));

    const textarea = screen.getByLabelText<HTMLTextAreaElement>("Document text");
    expect(textarea.value).toContain("EARNINGS STATEMENT");
  });

  it("shows the validation message from problem details", async () => {
    stubFetch(400, {
      title: "Invalid request",
      status: 400,
      errors: [{ path: "text", message: "Too big" }],
    });
    render(<App />);

    await userEvent.type(screen.getByLabelText("Document text"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Classify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too big");
  });

  it("hides a result once the text no longer matches it", async () => {
    stubFetch(200, llmResult);
    render(<App />);

    await userEvent.type(screen.getByLabelText("Document text"), "Payroll note");
    await userEvent.click(screen.getByRole("button", { name: "Classify" }));
    expect(await screen.findByTestId("doc-type")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear pay stub" }));

    expect(screen.queryByTestId("doc-type")).not.toBeInTheDocument();
  });
});
