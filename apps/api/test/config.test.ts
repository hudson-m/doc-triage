import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  it("runs offline by default", () => {
    expect(loadConfig({})).toMatchObject({ LLM_PROVIDER: "fake", PORT: 3000 });
  });

  it("resolves WEB_DIST to an absolute path", () => {
    const { WEB_DIST } = loadConfig({ WEB_DIST: "apps/web/dist" });

    expect(WEB_DIST && isAbsolute(WEB_DIST)).toBe(true);
  });

  it("lists every invalid variable at startup", () => {
    expect(() => loadConfig({ PORT: "abc", LLM_PROVIDER: "openai" })).toThrow(
      /PORT[\s\S]*LLM_PROVIDER|LLM_PROVIDER[\s\S]*PORT/,
    );
  });
});
