import { ProviderError, type ErrorKind } from "./types.js";

export function classifyError(err: unknown): ErrorKind {
  if (err instanceof ProviderError) return err.kind;
  const e = err as { status?: number; code?: number | string; name?: string; message?: string };
  const status = Number(e?.status ?? e?.code);
  const msg = String(e?.message ?? err).toLowerCase();
  if (e?.name === "AbortError" || /timeout|timed out|deadline/.test(msg)) return "timeout";
  if (status === 429 || /429|rate.?limit/.test(msg)) {
    return /resource_exhausted|quota|per day|billing|insufficient/.test(msg) ? "quota" : "rate_limit";
  }
  if ([500, 502, 503, 504, 529].includes(status) || /503|unavailable|overloaded|high demand|internal error/.test(msg)) return "overloaded";
  if (status === 401 || status === 403 || /api key not valid|invalid api key|permission denied|unauthorized/.test(msg)) return "auth";
  if (status === 400 || status === 404 || /invalid_argument|bad request|not found/.test(msg)) return "bad_request";
  return "unknown";
}

export const isRetryableSameModel = (k: ErrorKind) => k === "overloaded" || k === "rate_limit" || k === "timeout" || k === "unknown";

/** Backoff exponencial com jitter: base * 2^tentativa + [0, base). Teto de 30 s. */
export function backoffMs(attempt: number, baseMs: number, rand: () => number = Math.random): number {
  return Math.min(30_000, baseMs * 2 ** attempt + Math.floor(rand() * baseMs));
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
