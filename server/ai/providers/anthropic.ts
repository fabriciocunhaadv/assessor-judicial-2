import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { ProviderError, type FonteWeb, type GenerateRequest, type LlmProvider } from "../types.js";

const clients = new Map<string, Anthropic>();
const client = (apiKey: string) => {
  // maxRetries 0: retentativas, troca de chave e de modelo são feitas pelo orquestrador.
  if (!clients.has(apiKey)) clients.set(apiKey, new Anthropic({ apiKey, maxRetries: 0, timeout: env.ai.timeoutMs }));
  return clients.get(apiKey)!;
};

const INSTRUCAO_JSON = "Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto antes ou depois e sem cercas de código.";

/**
 * Monta a requisição (função pura, testada em tests/anthropicProvider.test.ts):
 * - `system` fixo (REGRAS_INEGOCIAVEIS) + documento grande com marcador de cache no início da
 *   primeira mensagem → chamadas sobre os mesmos autos reaproveitam o cache;
 * - sem `temperature` (os modelos Claude atuais rejeitam parâmetros de amostragem);
 * - profundidade por `output_config.effort` (no Opus 5.5 o padrão da API é "medium": definimos sempre);
 * - `fallbacks: "default"`: se os classificadores de segurança recusarem, a própria API refaz a chamada
 *   no modelo de apoio recomendado.
 */
export function montarRequisicao(model: string, req: GenerateRequest) {
  const turnos = req.messages.map((m) => ({ role: m.role, content: [{ type: "text" as const, text: m.content }] }));
  if (!turnos.length || turnos[0].role !== "user") throw new ProviderError("bad_request", "A conversa deve começar com uma mensagem do usuário.");

  if (req.json) {
    const ultimo = turnos[turnos.length - 1];
    if (ultimo.role === "user") ultimo.content.push({ type: "text", text: INSTRUCAO_JSON });
  }
  const primeiro = turnos[0].content as Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral"; ttl?: "5m" | "1h" } }>;
  if (req.documento?.texto) {
    const { rotulo, texto, ttl } = req.documento;
    primeiro.unshift({ type: "text", text: `<${rotulo}>\n${texto}\n</${rotulo}>`, cache_control: ttl === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" } });
  }

  const tools = req.buscaWeb
    ? [{ type: "web_search_20260209" as const, name: "web_search" as const, allowed_domains: req.buscaWeb.dominios, max_uses: req.buscaWeb.maxUsos ?? 5 }]
    : undefined;

  return {
    model,
    max_tokens: req.maxOutputTokens ?? 64_000,
    system: [{ type: "text" as const, text: req.system }],
    messages: turnos as Array<{ role: "user" | "assistant"; content: unknown[] }>,
    ...(tools ? { tools } : {}),
    output_config: { effort: req.esforco ?? env.ai.esforcoPadrao },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
  };
}

export function classificarErroApi(err: InstanceType<typeof Anthropic.APIError>): ProviderError {
  const s = err.status ?? 0;
  const msg = err.message ?? "";
  const kind =
    s === 429 ? "rate_limit"
    : s === 529 || s >= 500 ? "overloaded"
    : s === 401 || s === 403 ? "auth"
    : s === 400 && /credit|billing|balance/i.test(msg) ? "quota"
    : s === 400 || s === 404 || s === 413 ? "bad_request"
    : "unknown";
  return new ProviderError(kind, msg, s);
}

/** Claude — streaming + finalMessage() para minutas longas sem estourar o tempo limite HTTP. */
export const anthropicProvider: LlmProvider = {
  id: "anthropic",
  async generate(model, apiKey, req) {
    try {
      const params = montarRequisicao(model, req);
      const soma = { input: 0, output: 0, cacheLeitura: 0, cacheEscrita: 0, buscas: 0 };
      const somar = (u: Anthropic.Beta.BetaUsage) => {
        soma.input += u.input_tokens; soma.output += u.output_tokens;
        soma.cacheLeitura += u.cache_read_input_tokens ?? 0; soma.cacheEscrita += u.cache_creation_input_tokens ?? 0;
        soma.buscas += u.server_tool_use?.web_search_requests ?? 0;
      };
      let msg = await client(apiKey).beta.messages.stream(params as Parameters<Anthropic["beta"]["messages"]["stream"]>[0], { signal: req.signal }).finalMessage();
      somar(msg.usage);
      // Busca na web: o servidor pode pausar a volta longa (pause_turn); reenviamos para continuar.
      for (let i = 0; msg.stop_reason === "pause_turn" && i < 4; i++) {
        params.messages = [...params.messages, { role: "assistant", content: msg.content }];
        msg = await client(apiKey).beta.messages.stream(params as Parameters<Anthropic["beta"]["messages"]["stream"]>[0], { signal: req.signal }).finalMessage();
        somar(msg.usage);
      }

      if (msg.stop_reason === "refusal") {
        throw new ProviderError("refusal", `O Claude recusou o pedido (${msg.stop_details?.category ?? "sem categoria"}).`);
      }
      if (msg.stop_reason === "max_tokens") {
        throw new ProviderError("bad_request", "Resposta cortada pelo limite de tamanho. Divida o pedido.");
      }
      const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      if (!text.trim()) throw new ProviderError("unknown", "Resposta vazia do Claude.");
      const fontes = new Map<string, FonteWeb>();
      for (const b of msg.content) {
        if (b.type !== "text") continue;
        for (const c of b.citations ?? []) {
          if (c.type === "web_search_result_location" && !fontes.has(c.url)) fontes.set(c.url, { url: c.url, titulo: c.title ?? c.url, trecho: c.cited_text });
        }
      }
      return {
        text,
        fontes: [...fontes.values()],
        model: msg.model,
        inputTokens: soma.input,
        outputTokens: soma.output,
        cacheLeitura: soma.cacheLeitura,
        cacheEscrita: soma.cacheEscrita,
        buscasWeb: soma.buscas,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Anthropic.APIError) throw classificarErroApi(err);
      throw err;
    }
  },
};
