import { z } from "zod";
import { orchestrator } from "../ai/index.js";
import type { GenerateRequest, GenerateResult } from "../ai/types.js";
import type { Funcionalidade } from "../../shared/pricing.js";
import type { AuthUser } from "../middleware/requireAuth.js";
import { HttpError } from "../lib/httpError.js";
import { registrarUso } from "./usage.js";

export function schemaText(schema: z.ZodType): string {
  return JSON.stringify(z.toJSONSchema(schema), null, 1);
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("Nenhum JSON encontrado na resposta.");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Chama o orquestrador exigindo JSON válido no contrato zod.
 * Se a resposta vier fora do contrato, faz UMA nova tentativa informando o erro de validação ao modelo.
 */
export async function generateValidated<T>(
  user: AuthUser,
  funcionalidade: Funcionalidade,
  schema: z.ZodType<T>,
  req: Omit<GenerateRequest, "json">,
): Promise<{ data: T; result: GenerateResult }> {
  let messages = req.messages;
  let lastError = "";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const result = await orchestrator.generate({ ...req, messages, json: true });
    await registrarUso(user, funcionalidade, result);
    try {
      const data = schema.parse(extractJson(result.text));
      return { data, result };
    } catch (err) {
      lastError = err instanceof z.ZodError ? JSON.stringify(err.issues.slice(0, 15)) : String((err as Error).message);
      messages = [
        ...req.messages,
        { role: "assistant", content: result.text.slice(0, 4000) },
        { role: "user", content: `A resposta anterior não respeitou o schema. Erros: ${lastError}\nDevolva o objeto JSON completo e corrigido.` },
      ];
    }
  }
  throw new HttpError(502, "A IA devolveu resposta fora do contrato após nova tentativa.", lastError);
}
