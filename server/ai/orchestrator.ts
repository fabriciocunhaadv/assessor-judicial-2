import { backoffMs, classifyError, isRetryableSameModel, sleep as realSleep } from "./retry.js";
import type { AttemptLog, GenerateRequest, GenerateResult, LlmProvider } from "./types.js";

export interface OrchestratorConfig {
  keys: string[];
  models: string[];
  maxRetries: number;
  baseDelayMs: number;
}

export class AllProvidersFailedError extends Error {
  constructor(public attempts: AttemptLog[]) {
    super(
      "Todos os modelos e chaves do Claude configurados falharam. Última causa: " +
        (attempts.at(-1)?.error ?? "nenhuma chave ANTHROPIC_API_KEYS configurada"),
    );
  }
}

/**
 * Orquestrador do Claude.
 *
 * Cascata: modelo (na ordem de ANTHROPIC_MODELS) → chave do pool.
 *  - 529/5xx/timeout: retenta o MESMO modelo com backoff exponencial até `maxRetries`, depois próxima chave.
 *  - 429 por minuto: backoff; persistindo, rotaciona para a próxima chave do pool.
 *  - Crédito esgotado: rotaciona de chave imediatamente e a descarta nesta execução.
 *  - 401/403: chave inválida é descartada nesta execução.
 *  - 400 ou recusa (após o fallback do próprio servidor): pula para o próximo modelo.
 * A rotação de chaves é round-robin entre execuções para distribuir consumo.
 */
export class Orchestrator {
  private cursor = 0;

  constructor(
    private provider: LlmProvider,
    private cfg: OrchestratorConfig,
    private sleep: (ms: number, signal?: AbortSignal) => Promise<void> = realSleep,
    private rand: () => number = Math.random,
  ) {}

  configured(): { provider: "anthropic"; models: string[]; keys: number }[] {
    if (!this.cfg.keys.length || !this.cfg.models.length) return [];
    return [{ provider: "anthropic", models: this.cfg.models, keys: this.cfg.keys.length }];
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const attempts: AttemptLog[] = [];
    const { keys, models } = this.cfg;
    if (!keys.length || !models.length) throw new AllProvidersFailedError(attempts);
    const deadKeys = new Set<number>();
    const start = this.cursor;
    this.cursor = (start + 1) % keys.length;

    for (const model of models) {
      keyLoop: for (let k = 0; k < keys.length; k++) {
        const keyIndex = (start + k) % keys.length;
        if (deadKeys.has(keyIndex)) continue;

        for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
          if (req.signal?.aborted) throw new DOMException("Aborted", "AbortError");
          const t0 = Date.now();
          try {
            const r = await this.provider.generate(model, keys[keyIndex], req);
            attempts.push({ provider: "anthropic", model, keyIndex, ok: true, ms: Date.now() - t0 });
            return { ...r, provider: "anthropic", attempts };
          } catch (err) {
            const kind = classifyError(err);
            attempts.push({ provider: "anthropic", model, keyIndex, ok: false, kind, error: String((err as Error)?.message ?? err).slice(0, 300), ms: Date.now() - t0 });

            if (kind === "refusal" || kind === "bad_request") break keyLoop;
            if (kind === "auth" || kind === "quota") {
              deadKeys.add(keyIndex);
              continue keyLoop;
            }
            if (isRetryableSameModel(kind) && attempt < this.cfg.maxRetries) {
              await this.sleep(backoffMs(attempt, this.cfg.baseDelayMs, this.rand), req.signal);
              continue;
            }
            continue keyLoop;
          }
        }
      }
    }
    throw new AllProvidersFailedError(attempts);
  }
}
