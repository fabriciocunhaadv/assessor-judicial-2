import OpenAI from "openai";
import { env } from "../../config/env.js";
import { ProviderError, type LlmProvider } from "../types.js";

const clients = new Map<string, OpenAI>();
const client = (apiKey: string) => {
  if (!clients.has(apiKey)) clients.set(apiKey, new OpenAI({ apiKey, maxRetries: 0, timeout: env.ai.timeoutMs }));
  return clients.get(apiKey)!;
};

/**
 * OpenAI via Responses API. Desativado enquanto OPENAI_MODELS estiver vazio.
 * `temperature` não é enviado porque parte dos modelos de raciocínio o rejeita.
 */
export const openaiProvider: LlmProvider = {
  id: "openai",
  async generate(model, apiKey, req) {
    try {
      const r = await client(apiKey).responses.create(
        {
          model,
          instructions: req.system,
          input: req.messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: req.maxOutputTokens ?? 64_000,
          ...(req.json ? { text: { format: { type: "json_object" as const } } } : {}),
        },
        { signal: req.signal },
      );
      if (r.status === "incomplete") {
        throw new ProviderError("bad_request", `Resposta incompleta (${r.incomplete_details?.reason ?? "motivo n/d"}).`);
      }
      return { text: r.output_text, model, inputTokens: r.usage?.input_tokens ?? 0, outputTokens: r.usage?.output_tokens ?? 0 };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof OpenAI.APIError) {
        const s = err.status ?? 0;
        const kind = s === 429 ? (/quota/i.test(err.message) ? "quota" : "rate_limit") : s >= 500 ? "overloaded" : s === 401 || s === 403 ? "auth" : s === 400 || s === 404 ? "bad_request" : "unknown";
        throw new ProviderError(kind, err.message, s);
      }
      throw err;
    }
  },
};
