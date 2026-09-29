import type { ProviderId } from "../config/env.js";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  system: string;
  messages: ChatTurn[];
  /** 0.0 na Etapa 1 (fático). Ignorado por modelos que não aceitam sampling (ex.: Claude Opus 5.5). */
  temperature?: number;
  maxOutputTokens?: number;
  /** Quando true, o provedor é instruído a devolver JSON puro. */
  json?: boolean;
  /** JSON Schema do contrato esperado (usado por provedores com saída estruturada nativa). */
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Rastro das tentativas (modelo/chave/erro) — exibido no painel do Super Admin. */
  attempts: AttemptLog[];
}

export interface AttemptLog {
  provider: ProviderId;
  model: string;
  keyIndex: number;
  ok: boolean;
  error?: string;
  kind?: ErrorKind;
  ms: number;
}

/** Classificação de erro que decide a próxima ação da cascata. */
export type ErrorKind =
  | "overloaded" // 503/529/UNAVAILABLE → retentar com backoff, depois próximo modelo
  | "rate_limit" // 429 por minuto → backoff; esgotado → próxima chave
  | "quota" //      429 RESOURCE_EXHAUSTED diário/cota → próxima chave imediatamente
  | "timeout"
  | "auth" //       401/403 → chave inválida, descartar chave
  | "bad_request" //400 → não adianta repetir no mesmo modelo; tenta o próximo modelo
  | "refusal" //    recusa de segurança → próximo provedor
  | "unknown";

export class ProviderError extends Error {
  constructor(public kind: ErrorKind, message: string, public status?: number) {
    super(message);
  }
}

export interface LlmProvider {
  id: ProviderId;
  generate(model: string, apiKey: string, req: GenerateRequest): Promise<Omit<GenerateResult, "attempts" | "provider">>;
}
