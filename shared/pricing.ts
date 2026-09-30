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

export type Funcionalidade = "minuta" | "lupa" | "audiencia" | "chat" | "precedentes" | "sinopse" | "pesquisa";

/** Multiplicadores do prompt caching sobre o preço de entrada: leitura 0,1×; escrita 1,25× (5 min). */
export const CACHE_LEITURA = 0.1;
export const CACHE_ESCRITA = 1.25;
/** Busca na web (ferramenta do servidor): US$ 10 por 1.000 buscas. */
export const USD_POR_BUSCA = 0.01;

export interface ConsumoTokens {
  inputTokens: number;
  outputTokens: number;
  cacheLeitura?: number;
  cacheEscrita?: number;
  buscasWeb?: number;
}

/**
 * Custo de uma chamada. `inputTokens` é só a parte NÃO cacheada (como a API informa);
 * `economiaUsd` é quanto a leitura do cache poupou em relação ao preço cheio de entrada.
 */
export function custoUsd(model: string, c: ConsumoTokens): { usd: number; economiaUsd: number; tabelado: boolean } {
  const p = PRICES_USD[model];
  const buscas = (c.buscasWeb ?? 0) * USD_POR_BUSCA;
  if (!p) return { usd: buscas, economiaUsd: 0, tabelado: false };
  const m = (t = 0) => (t / 1e6) * p.inputPerM;
  const usd = m(c.inputTokens) + m(c.cacheLeitura) * CACHE_LEITURA + m(c.cacheEscrita) * CACHE_ESCRITA + (c.outputTokens / 1e6) * p.outputPerM + buscas;
  return { usd, economiaUsd: m(c.cacheLeitura) * (1 - CACHE_LEITURA), tabelado: true };
}
