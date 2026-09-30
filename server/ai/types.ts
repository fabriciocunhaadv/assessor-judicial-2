/** Esforço de raciocínio do Claude (output_config.effort). */
export type Esforco = "low" | "medium" | "high" | "xhigh" | "max";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Documento grande reutilizado entre chamadas (autos, resumo executivo, dossiê).
 * Vai no início da primeira mensagem com marcador de cache: chamadas seguintes com o mesmo
 * documento (Etapa 1 → Resumo Executivo, retentativas, chat) pagam ~5% do preço de entrada.
 */
export interface DocumentoCacheado {
  rotulo: string;
  texto: string;
  /** "5m" (padrão, escrita 1,25×) ou "1h" (escrita 2×; para conversas com pausas longas, como o chat). */
  ttl?: "5m" | "1h";
}

export interface GenerateRequest {
  /** Instruções fixas. Mantenha idênticas entre chamadas (prefixo de cache): use REGRAS_INEGOCIAVEIS. */
  system: string;
  documento?: DocumentoCacheado;
  messages: ChatTurn[];
  esforco?: Esforco;
  maxOutputTokens?: number;
  /** Quando true, a instrução pede JSON puro (validado depois com zod). */
  json?: boolean;
  /** Pesquisa ao vivo com a ferramenta de busca na web do Claude, restrita aos domínios oficiais indicados. */
  buscaWeb?: { dominios: string[]; maxUsos?: number };
  signal?: AbortSignal;
}

export interface Consumo {
  inputTokens: number;
  outputTokens: number;
  cacheLeitura: number;
  cacheEscrita: number;
  buscasWeb: number;
}

export interface FonteWeb {
  url: string;
  titulo: string;
  trecho: string;
}

export interface GenerateResult extends Consumo {
  text: string;
  /** Fontes citadas pela busca na web (vazio quando não houve busca). */
  fontes?: FonteWeb[];
  provider: "anthropic";
  model: string;
  /** Rastro das tentativas (modelo/chave/erro) — exibido no painel do Super Admin. */
  attempts: AttemptLog[];
}

export interface AttemptLog {
  provider: "anthropic";
  model: string;
  keyIndex: number;
  ok: boolean;
  error?: string;
  kind?: ErrorKind;
  ms: number;
}

/** Classificação de erro que decide a próxima ação da cascata. */
export type ErrorKind =
  | "overloaded" // 500/529 → retentar com backoff, depois próximo modelo
  | "rate_limit" // 429 → backoff; persistindo, próxima chave
  | "quota" //      cota/crédito esgotado → próxima chave imediatamente
  | "timeout"
  | "auth" //       401/403 → chave inválida, descartar chave
  | "bad_request" //400 → não adianta repetir no mesmo modelo
  | "refusal" //    recusa de segurança mesmo após o fallback do servidor
  | "unknown";

export class ProviderError extends Error {
  constructor(public kind: ErrorKind, message: string, public status?: number) {
    super(message);
  }
}

export interface LlmProvider {
  id: "anthropic";
  generate(model: string, apiKey: string, req: GenerateRequest): Promise<Omit<GenerateResult, "attempts" | "provider">>;
}
