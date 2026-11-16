import { expect, test } from "@playwright/test";

// Two journeys through the real browser, API and pipeline. Business rules are covered by
// unit and integration tests; these only prove the pieces are wired together.

test("a clear document is decided by the rules", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Clear pay stub" }).click();
  await page.getByRole("button", { name: "Classify" }).click();

  await expect(page.getByTestId("doc-type")).toHaveText("pay stub");
  await expect(page.getByTestId("route")).toContainText("Decided by rules");
  await expect(page.getByTestId("sent-text")).toHaveCount(0);
});

test("an ambiguous document reaches the LLM with personal data masked", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Ambiguous, with PII" }).click();
  await page.getByRole("button", { name: "Classify" }).click();

  await expect(page.getByTestId("route")).toContainText("LLM fallback");
  const sent = page.getByTestId("sent-text");
  await expect(sent).toContainText("SSN [SSN]");
  await expect(sent).toContainText("[EMAIL]");
  await expect(sent).not.toContainText("512-44-9031");
});
