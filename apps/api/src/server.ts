import { classifyDocument } from "@doc-triage/core";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createLlmClassifier } from "./llm-factory.ts";

const config = loadConfig(process.env);
const llm = createLlmClassifier(config);

const app = await buildApp({
  classify: (text) => classifyDocument(text, { llm, minLlmConfidence: config.MIN_LLM_CONFIDENCE }),
  webDist: config.WEB_DIST,
  logger: true,
});

// Containers stop with SIGTERM: finish in-flight requests before exiting.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

app.log.info({ provider: config.LLM_PROVIDER, model: llm.model }, "LLM fallback configured");
await app.listen({ port: config.PORT, host: config.HOST });
