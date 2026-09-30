import { describe, expect, it, vi } from "vitest";
import { AllProvidersFailedError, Orchestrator } from "../server/ai/orchestrator";
import { ProviderError, type LlmProvider } from "../server/ai/types";

const ok = (model: string) => ({ text: "ok", model, inputTokens: 10, outputTokens: 5, cacheLeitura: 0, cacheEscrita: 0, buscasWeb: 0 });
const cfg = (over: Partial<ConstructorParameters<typeof Orchestrator>[1]> = {}) => ({
  keys: ["k1", "k2"],
  models: ["claude-opus-5-5", "claude-sonnet-5-5"],
  maxRetries: 2,
  baseDelayMs: 1,
  ...over,
});
const noSleep = vi.fn(async () => {});
const req = { system: "s", messages: [{ role: "user" as const, content: "x" }] };

function fake(impl: (model: string, key: string) => Promise<any>): LlmProvider {
  return { id: "anthropic", generate: vi.fn((m: string, k: string) => impl(m, k)) as any };
}

describe("orquestrador do Claude", () => {
  it("retenta sobrecarga (529) no mesmo modelo com backoff e depois tem sucesso", async () => {
    let n = 0;
    const p = fake(async (m) => { if (n++ < 2) throw new ProviderError("overloaded", "529"); return ok(m); });
    const r = await new Orchestrator(p, cfg(), noSleep).generate(req);
    expect(r.model).toBe("claude-opus-5-5");
    expect(r.provider).toBe("anthropic");
    expect(r.attempts).toHaveLength(3);
  });

  it("crédito esgotado descarta a chave e segue com a próxima", async () => {
    const p = fake(async (m, k) => { if (k === "k1") throw new ProviderError("quota", "credit balance too low"); return ok(m); });
    const r = await new Orchestrator(p, cfg(), noSleep).generate(req);
    expect(r.attempts.at(-1)).toMatchObject({ ok: true, keyIndex: 1 });
  });

  it("recusa ou 400 pula direto para o próximo modelo da cascata", async () => {
    const p = fake(async (m) => { if (m === "claude-opus-5-5") throw new ProviderError("refusal", "recusado"); return ok(m); });
    const r = await new Orchestrator(p, cfg(), noSleep).generate(req);
    expect(r.model).toBe("claude-sonnet-5-5");
    expect(r.attempts.filter((a) => a.model === "claude-opus-5-5")).toHaveLength(1);
  });

  it("chaves inválidas em todos os modelos esgotam a cascata com erro claro", async () => {
    const p = fake(async () => { throw new ProviderError("auth", "401"); });
    await expect(new Orchestrator(p, cfg(), noSleep).generate(req)).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it("sem chave configurada, informa que falta ANTHROPIC_API_KEYS", async () => {
    const o = new Orchestrator(fake(async (m) => ok(m)), cfg({ keys: [] }), noSleep);
    expect(o.configured()).toEqual([]);
    await expect(o.generate(req)).rejects.toThrow(/ANTHROPIC_API_KEYS/);
  });
});
