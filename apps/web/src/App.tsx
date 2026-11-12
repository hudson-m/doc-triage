import type { ClassificationResult } from "@doc-triage/core";
import { useActionState, useState } from "react";
import { classify } from "./api.ts";
import { ResultCard } from "./components/ResultCard.tsx";
import { SAMPLES } from "./samples.ts";

type State =
  | { readonly status: "idle" }
  | { readonly status: "done"; readonly result: ClassificationResult }
  | { readonly status: "error"; readonly message: string };

async function submit(_previous: State, form: FormData): Promise<State> {
  const text = form.get("text");
  if (typeof text !== "string") return { status: "error", message: "Missing text" };
  try {
    return { status: "done", result: await classify(text) };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}

export function App() {
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState(submit, { status: "idle" });

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

      {state.status === "error" && (
        <p role="alert" className="error">
          {state.message}
        </p>
      )}
      {state.status === "done" && <ResultCard result={state.result} />}
    </main>
  );
}
