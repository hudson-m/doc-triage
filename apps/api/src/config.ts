import { resolve } from "node:path";
import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LLM_PROVIDER: z.enum(["fake", "anthropic"]).default("fake"),
  LLM_MODEL: z.string().min(1).default("claude-opus-5-5"),
  MIN_LLM_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
  /** Folder with the built web app. When set, the API also serves the UI (one container). */
  WEB_DIST: z
    .string()
    .min(1)
    .transform((path) => resolve(path))
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Fails fast at startup with every invalid variable listed, instead of failing on first use. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
