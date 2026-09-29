/**
 * Tabela de preços por 1 milhão de tokens (USD). Atualize conforme o contrato vigente de cada provedor.
 * Modelos ausentes da tabela são registrados com custo 0 e sinalizados no painel do Super Admin.
 */
export interface Price { inputPerM: number; outputPerM: number }

export const PRICES_USD: Record<string, Price> = {
  "claude-opus-5-5": { inputPerM: 4, outputPerM: 20 },
  "claude-sonnet-5-5": { inputPerM: 2, outputPerM: 10 },
  "claude-haiku-4-5": { inputPerM: 1, outputPerM: 5 },
};

export type Funcionalidade = "minuta" | "lupa" | "audiencia" | "chat" | "precedentes" | "sinopse";

export function custoUsd(model: string, inputTokens: number, outputTokens: number): { usd: number; tabelado: boolean } {
  const p = PRICES_USD[model];
  if (!p) return { usd: 0, tabelado: false };
  return { usd: (inputTokens / 1e6) * p.inputPerM + (outputTokens / 1e6) * p.outputPerM, tabelado: true };
}
