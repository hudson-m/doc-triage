# 4. Offline by default, and an evaluation gate in CI

**Status:** accepted

## Context

A project that needs an API key to start is a project nobody runs: not reviewers, not CI,
not a new teammate. And LLM features regress silently; a unit test that mocks the model
says nothing about accuracy or cost.

## Decision

- `LLM_PROVIDER=fake` is the default. `FakeLlmClassifier` is deterministic and estimates
  token usage the way a real call is billed, so cost reports keep their shape.
- `LLM_PROVIDER=anthropic` switches to the real adapter. The key is read from the
  environment by the SDK, never from code or committed files.
- `npm run eval` runs the real pipeline over `dataset/labeled.jsonl` and reports coverage,
  accuracy per route, and the cost of the hybrid pipeline against sending every document to
  the LLM.
- CI runs the eval with `--min-rules-accuracy 1`: the rules are deterministic, so any
  misclassification by them fails the build.

## Consequences

- `git clone && npm ci && npm test` works with no account and no cost.
- In fake mode, LLM accuracy is meaningless and the CLI says so. Real numbers need
  `LLM_PROVIDER=anthropic` and cost real money (cents for this dataset).
- The dataset is synthetic and deliberately heavy on ambiguous documents, so the cost
  reduction it shows is a floor, not a production figure.
