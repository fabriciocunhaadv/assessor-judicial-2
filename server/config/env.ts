import "dotenv/config";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export type ProviderId = "gemini" | "anthropic" | "openai";

export const env = {
  port: num(process.env.PORT, 8787),
  isProd: process.env.NODE_ENV === "production",
  authDisabled: process.env.AUTH_DISABLED === "true",
  superAdminEmails: list(process.env.SUPER_ADMIN_EMAILS).map((e) => e.toLowerCase()),
  dataBackend: (process.env.DATA_BACKEND === "firestore" ? "firestore" : "memory") as "firestore" | "memory",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || undefined,
  ai: {
    order: list(process.env.AI_PROVIDER_ORDER || "gemini,anthropic,openai") as ProviderId[],
    keys: {
      gemini: list(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY),
      anthropic: list(process.env.ANTHROPIC_API_KEYS || process.env.ANTHROPIC_API_KEY),
      openai: list(process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY),
    } as Record<ProviderId, string[]>,
    models: {
      gemini: list(process.env.GEMINI_MODELS || "gemini-3.8-flash,gemini-3.7-flash,gemini-flash-latest"),
      anthropic: list(process.env.ANTHROPIC_MODELS || "claude-opus-5-5"),
      openai: list(process.env.OPENAI_MODELS),
    } as Record<ProviderId, string[]>,
    anthropicEffort: (process.env.ANTHROPIC_EFFORT || "high") as "low" | "medium" | "high" | "xhigh" | "max",
    maxRetries: num(process.env.AI_MAX_RETRIES, 3),
    baseDelayMs: num(process.env.AI_BASE_DELAY_MS, 1500),
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 600_000),
  },
  usdBrl: num(process.env.USD_BRL, 5.4),
};

export function assertSafeConfig(): void {
  if (env.isProd && env.authDisabled) {
    throw new Error("AUTH_DISABLED=true não é permitido em produção. Abortando inicialização.");
  }
  if (env.isProd && env.dataBackend !== "firestore") {
    throw new Error("Em produção DATA_BACKEND deve ser 'firestore' (o repositório em memória perde dados).");
  }
}
