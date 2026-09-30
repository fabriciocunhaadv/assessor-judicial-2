import { describe, expect, it } from "vitest";
import { montarRequisicao } from "../server/ai/providers/anthropic";
import { custoUsd } from "../shared/pricing";

describe("montarRequisicao (Claude)", () => {
  it("põe o documento com cache no início da 1ª mensagem, sem temperature e com esforço", () => {
    const r = montarRequisicao("claude-opus-5-5", {
      system: "regras",
      documento: { rotulo: "autos", texto: "AUTOS", ttl: "1h" },
      messages: [{ role: "user", content: "pergunta" }],
      esforco: "high",
      json: true,
    });
    const blocos = r.messages[0].content as Array<{ text: string; cache_control?: unknown }>;
    expect(blocos[0]).toEqual({ type: "text", text: "<autos>\nAUTOS\n</autos>", cache_control: { type: "ephemeral", ttl: "1h" } });
    expect(blocos[1].text).toBe("pergunta");
    expect(blocos.at(-1)!.text).toMatch(/JSON/);
    expect(r.output_config).toEqual({ effort: "high" });
    expect(r).not.toHaveProperty("temperature");
    expect(r).not.toHaveProperty("tools");
  });

  it("habilita a busca na web restrita aos domínios oficiais", () => {
    const r = montarRequisicao("claude-opus-5-5", { system: "s", messages: [{ role: "user", content: "q" }], buscaWeb: { dominios: ["stj.jus.br"] } });
    expect(r.tools).toEqual([{ type: "web_search_20260209", name: "web_search", allowed_domains: ["stj.jus.br"], max_uses: 5 }]);
  });

  it("recusa conversa que não começa pelo usuário", () => {
    expect(() => montarRequisicao("m", { system: "s", messages: [{ role: "assistant", content: "x" }] })).toThrow();
  });
});

describe("custoUsd com cache e buscas", () => {
  it("cobra leitura de cache a 10% e calcula a economia", () => {
    const c = custoUsd("claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 0, cacheLeitura: 1_000_000, cacheEscrita: 0, buscasWeb: 2 });
    expect(c.usd).toBeCloseTo(4 + 0.4 + 0.02);
    expect(c.economiaUsd).toBeCloseTo(3.6);
  });
});
