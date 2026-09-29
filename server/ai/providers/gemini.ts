import { GoogleGenAI } from "@google/genai";
import { ProviderError, type LlmProvider } from "../types.js";

const clients = new Map<string, GoogleGenAI>();
const client = (apiKey: string) => {
  if (!clients.has(apiKey)) clients.set(apiKey, new GoogleGenAI({ apiKey }));
  return clients.get(apiKey)!;
};

export const geminiProvider: LlmProvider = {
  id: "gemini",
  async generate(model, apiKey, req) {
    const res = await client(apiKey).models.generateContent({
      model,
      contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      config: {
        systemInstruction: req.system,
        temperature: req.temperature,
        maxOutputTokens: req.maxOutputTokens ?? 65_536,
        responseMimeType: req.json ? "application/json" : undefined,
        abortSignal: req.signal,
      },
    });

    if (res.promptFeedback?.blockReason) {
      throw new ProviderError("refusal", `Gemini bloqueou o conteúdo: ${res.promptFeedback.blockReason}`);
    }
    const finish = res.candidates?.[0]?.finishReason;
    if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
      throw new ProviderError("refusal", `Gemini interrompeu por política de segurança (${finish}).`);
    }
    const text = res.text ?? "";
    if (!text.trim()) throw new ProviderError("unknown", `Resposta vazia do Gemini (finishReason=${finish ?? "n/d"}).`);

    return {
      text,
      model,
      inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
    };
  },
};
