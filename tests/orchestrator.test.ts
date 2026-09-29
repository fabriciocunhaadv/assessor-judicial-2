import { describe, expect, it, vi } from "vitest";
import { AllProvidersFailedError, Orchestrator } from "../server/ai/orchestrator";
import { ProviderError, type LlmProvider } from "../server/ai/types";

const ok = (model: string) => ({ text: "ok", model, inputTokens: 10, outputTokens: 5 });
const cfg = (over: Partial<ConstructorParameters<typeof Orchestrator>[1]> = {}) => ({
  order: ["gemini", "anthropic", "openai"] as const as any,
  keys: { gemini: ["g1", "g2"], anthropic: ["a1"], openai: [] },
  models: { gemini: ["m1", "m2"], anthropic: ["claude-opus-5-5"], openai: [] },
  maxRetries: 2,
  baseDelayMs: 1,
  ...over,
});
const noSleep = vi.fn(async () => {});

function fake(id: any, impl: (model: string, key: string) => Promise<any>): LlmProvider {
  return { id, generate: vi.fn((m: string, k: string) => impl(m, k)) as any };
}

describe("orquestrador multi-modelo", () => {
  it("retenta 503 no mesmo modelo com backoff e depois tem sucesso", async () => {
    let n = 0;
    const g = fake("gemini", async (m) => { if (n++ < 2) throw new ProviderError("overloaded", "503"); return ok(m); });
    const o = new Orchestrator({ gemini: g, anthropic: undefined, openai: undefined }, cfg(), noSleep);
    const r = await o.generate({ system: "s", messages: [{ role: "user", content: "x" }] });
    expect(r.model).toBe("m1");
    expect(r.attempts.filter((a) => !a.ok)).toHaveLength(2);
  });

  it("rotaciona para a chave reserva quando a cota esgota (429 RESOURCE_EXHAUSTED)", async () => {
    const g = fake("gemini", async (m, k) => { if (k === "g1") throw new ProviderError("quota", "429 RESOURCE_EXHAUSTED"); return ok(m); });
    const o = new Orchestrator({ gemini: g, anthropic: undefined, openai: undefined }, cfg(), noSleep);
    const r = await o.generate({ system: "s", messages: [{ role: "user", content: "x" }] });
    expect(r.attempts.at(-1)).toMatchObject({ ok: true, keyIndex: 1 });
  });

  it("cai para o próximo provedor quando todos os modelos Gemini falham", async () => {
    const g = fake("gemini", async () => { throw new ProviderError("overloaded", "503"); });
    const a = fake("anthropic", async (m) => ok(m));
    const o = new Orchestrator({ gemini: g, anthropic: a, openai: undefined }, cfg(), noSleep);
    const r = await o.generate({ system: "s", messages: [{ role: "user", content: "x" }] });
    expect(r.provider).toBe("anthropic");
  });

  it("recusa de segurança pula direto para o próximo provedor", async () => {
    const g = fake("gemini", async () => { throw new ProviderError("refusal", "SAFETY"); });
    const a = fake("anthropic", async (m) => ok(m));
    const o = new Orchestrator({ gemini: g, anthropic: a, openai: undefined }, cfg(), noSleep);
    await o.generate({ system: "s", messages: [{ role: "user", content: "x" }] });
    expect(g.generate).toHaveBeenCalledTimes(1);
  });

  it("falha com relatório completo quando nada funciona", async () => {
    const g = fake("gemini", async () => { throw new ProviderError("auth", "401"); });
    const o = new Orchestrator({ gemini: g, anthropic: undefined, openai: undefined }, cfg(), noSleep);
    await expect(o.generate({ system: "s", messages: [{ role: "user", content: "x" }] })).rejects.toBeInstanceOf(AllProvidersFailedError);
  });
});
