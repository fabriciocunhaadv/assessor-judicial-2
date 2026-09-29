import type { ProviderId } from "../config/env.js";
import { backoffMs, classifyError, isRetryableSameModel, sleep as realSleep } from "./retry.js";
import type { AttemptLog, GenerateRequest, GenerateResult, LlmProvider } from "./types.js";

export interface OrchestratorConfig {
  order: ProviderId[];
  keys: Record<ProviderId, string[]>;
  models: Record<ProviderId, string[]>;
  maxRetries: number;
  baseDelayMs: number;
}

export class AllProvidersFailedError extends Error {
  constructor(public attempts: AttemptLog[]) {
    super(
      "Todos os modelos e chaves configurados falharam. Última causa: " +
        (attempts.at(-1)?.error ?? "nenhum provedor configurado"),
    );
  }
}

/**
 * Orquestrador multi-modelo.
 *
 * Cascata: provedor (na ordem configurada) → modelo (na ordem configurada) → chave do pool.
 *  - 503/sobrecarga/timeout: retenta o MESMO modelo com backoff exponencial até `maxRetries`, depois próxima chave/modelo.
 *  - 429 por minuto: backoff; persistindo, rotaciona para a próxima chave do pool.
 *  - 429 de cota esgotada: rotaciona de chave imediatamente e a marca como esgotada nesta execução.
 *  - 401/403: chave inválida é descartada nesta execução.
 *  - 400: pula para o próximo modelo (o mesmo pedido não vai passar repetindo).
 *  - Recusa de segurança: pula para o próximo provedor.
 * A rotação de chaves é round-robin entre execuções para distribuir consumo.
 */
export class Orchestrator {
  private cursor = new Map<ProviderId, number>();

  constructor(
    private providers: Record<ProviderId, LlmProvider | undefined>,
    private cfg: OrchestratorConfig,
    private sleep: (ms: number, signal?: AbortSignal) => Promise<void> = realSleep,
    private rand: () => number = Math.random,
  ) {}

  configured(): { provider: ProviderId; models: string[]; keys: number }[] {
    return this.cfg.order
      .filter((p) => this.providers[p] && this.cfg.keys[p]?.length && this.cfg.models[p]?.length)
      .map((p) => ({ provider: p, models: this.cfg.models[p], keys: this.cfg.keys[p].length }));
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const attempts: AttemptLog[] = [];

    providerLoop: for (const { provider: pid, models } of this.configured()) {
      const provider = this.providers[pid]!;
      const keys = this.cfg.keys[pid];
      const deadKeys = new Set<number>();
      const start = this.cursor.get(pid) ?? 0;
      this.cursor.set(pid, (start + 1) % keys.length);

      for (const model of models) {
        modelLoop: for (let k = 0; k < keys.length; k++) {
          const keyIndex = (start + k) % keys.length;
          if (deadKeys.has(keyIndex)) continue;

          for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
            if (req.signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const t0 = Date.now();
            try {
              const r = await provider.generate(model, keys[keyIndex], req);
              attempts.push({ provider: pid, model, keyIndex, ok: true, ms: Date.now() - t0 });
              return { ...r, provider: pid, attempts };
            } catch (err) {
              const kind = classifyError(err);
              attempts.push({ provider: pid, model, keyIndex, ok: false, kind, error: String((err as Error)?.message ?? err).slice(0, 300), ms: Date.now() - t0 });

              if (kind === "refusal") continue providerLoop;
              if (kind === "bad_request") break modelLoop;
              if (kind === "auth" || kind === "quota") {
                deadKeys.add(keyIndex);
                continue modelLoop;
              }
              if (isRetryableSameModel(kind) && attempt < this.cfg.maxRetries) {
                await this.sleep(backoffMs(attempt, this.cfg.baseDelayMs, this.rand), req.signal);
                continue;
              }
              continue modelLoop; // esgotou retentativas nesta chave
            }
          }
        }
      }
    }
    throw new AllProvidersFailedError(attempts);
  }
}
