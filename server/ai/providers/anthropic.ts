import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { ProviderError, type LlmProvider } from "../types.js";

const clients = new Map<string, Anthropic>();
const client = (apiKey: string) => {
  // maxRetries 0: as retentativas e o fallback são responsabilidade do orquestrador.
  if (!clients.has(apiKey)) clients.set(apiKey, new Anthropic({ apiKey, maxRetries: 0, timeout: env.ai.timeoutMs }));
  return clients.get(apiKey)!;
};

/**
 * Claude (padrão: claude-opus-5-5).
 * - Não envia `temperature`: os modelos Claude atuais rejeitam parâmetros de amostragem;
 *   a profundidade é controlada por `output_config.effort`.
 * - Streaming + finalMessage() para saídas longas (minutas de 20+ parágrafos) sem estourar timeout HTTP.
 * - `fallbacks: "default"`: em recusa dos classificadores de segurança, a própria API reexecuta
 *   o pedido no modelo de fallback recomendado.
 */
export const anthropicProvider: LlmProvider = {
  id: "anthropic",
  async generate(model, apiKey, req) {
    try {
      const stream = client(apiKey).beta.messages.stream(
        {
          model,
          max_tokens: req.maxOutputTokens ?? 64_000,
          system: req.json ? `${req.system}\n\nResponda EXCLUSIVAMENTE com um objeto JSON válido, sem texto antes ou depois.` : req.system,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          output_config: { effort: env.ai.anthropicEffort },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { signal: req.signal },
      );
      const msg = await stream.finalMessage();

      if (msg.stop_reason === "refusal") {
        throw new ProviderError("refusal", `Claude recusou o pedido (${msg.stop_details?.category ?? "sem categoria"}).`);
      }
      if (msg.stop_reason === "max_tokens") {
        throw new ProviderError("bad_request", "Resposta truncada por max_tokens.");
      }
      const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      return { text, model: msg.model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Anthropic.APIError) {
        const s = err.status ?? 0;
        const kind = s === 429 ? "rate_limit" : s === 529 || s >= 500 ? "overloaded" : s === 401 || s === 403 ? "auth" : s === 400 || s === 404 ? "bad_request" : "unknown";
        throw new ProviderError(kind, err.message, s);
      }
      throw err;
    }
  },
};
