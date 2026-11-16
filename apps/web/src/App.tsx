import type { ClassificationResult } from "@doc-triage/core";
import { useActionState, useState } from "react";
import { classify } from "./api.ts";
import { ResultCard } from "./components/ResultCard.tsx";
import { SAMPLES } from "./samples.ts";

// Each outcome remembers the text it belongs to, so it is never shown next to other text.
type State =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly text: string; readonly result: ClassificationResult }
  | { readonly status: "error"; readonly text: string; readonly message: string };

async function submit(_previous: State, form: FormData): Promise<State> {
  const text = form.get("text");
  if (typeof text !== "string") return { status: "error", text: "", message: "Missing text" };
  try {
    return { status: "done", text, result: await classify(text) };
  } catch (error) {
    return {
      status: "error",
      text,
      message: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}

export function App() {
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState(submit, { status: "idle" });
  // Hide an outcome once the text changes, including one that arrives after the change.
  const current = state.status !== "idle" && state.text === text ? state : undefined;

  return (
    <main>
      <header>
        <h1>doc-triage</h1>
        <p>Rules first, LLM only when needed, and only with personal data masked.</p>
      </header>

      <form action={action}>
        <label htmlFor="text">Document text</label>
        <textarea
          id="text"
          name="text"
          rows={9}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          placeholder="Paste the text extracted from a document"
        />
        <div className="actions">
          <div className="samples">
            {SAMPLES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                className="secondary"
                onClick={() => {
                  setText(sample.text);
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>
          <button type="submit" disabled={pending || text.trim() === ""}>
            {pending ? "Classifying…" : "Classify"}
          </button>
        </div>
      </form>

      {current?.status === "error" && (
        <p role="alert" className="error">
          {current.message}
        </p>
      )}
      {current?.status === "done" && <ResultCard result={current.result} />}
    </main>
  );
}
