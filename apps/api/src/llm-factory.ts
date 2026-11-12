import Anthropic from "@anthropic-ai/sdk";
import { FakeLlmClassifier, type LlmClassifier } from "@doc-triage/core";
import { AnthropicClassifier } from "./adapters/anthropic-classifier.ts";
import type { Config } from "./config.ts";

/** Composition root for the LLM port: the only place that knows which adapter runs. */
export function createLlmClassifier(
  config: Pick<Config, "LLM_PROVIDER" | "LLM_MODEL">,
): LlmClassifier {
  switch (config.LLM_PROVIDER) {
    case "fake":
      return new FakeLlmClassifier(config.LLM_MODEL);
    case "anthropic":
      // Credentials come from the environment (ANTHROPIC_API_KEY); never from code or config files.
      return new AnthropicClassifier(
        new Anthropic({ timeout: 30_000, maxRetries: 2 }),
        config.LLM_MODEL,
      );
  }
}
