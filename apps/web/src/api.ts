import type { ClassificationResult } from "@doc-triage/core";

interface Problem {
  readonly title?: string;
  readonly errors?: readonly { message: string }[];
}

/** Calls the API. Turns RFC 9457 problem details into a readable error message. */
export async function classify(text: string): Promise<ClassificationResult> {
  const response = await fetch("/api/classify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as Problem | null;
    throw new Error(
      problem?.errors?.[0]?.message ?? problem?.title ?? `Request failed (${response.status})`,
    );
  }
  // Our own API, validated on the server side; a runtime schema here would duplicate it.
  return (await response.json()) as ClassificationResult;
}
