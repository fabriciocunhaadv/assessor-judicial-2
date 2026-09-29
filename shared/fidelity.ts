/**
 * Fidelidade alfanumérica: todo número de processo, valor, data e telefone citado na minuta
 * precisa existir literalmente nos autos. O que não existir é sinalizado como possível alucinação.
 */

const PATTERNS = {
  cnj: /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g,
  valor: /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g,
  data: /\b\d{2}\/\d{2}\/\d{4}\b/g,
  telefone: /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g,
} as const;

export type TipoDado = keyof typeof PATTERNS;

export interface Divergencia {
  tipo: TipoDado;
  valor: string;
}

const norm = (s: string) => s.replace(/\s+/g, "").replace(/[()]/g, "");

export function extrairDados(texto: string): Record<TipoDado, string[]> {
  const out = {} as Record<TipoDado, string[]>;
  (Object.keys(PATTERNS) as TipoDado[]).forEach((k) => {
    out[k] = Array.from(new Set(texto.match(PATTERNS[k]) ?? []));
  });
  return out;
}

/** Lista dados presentes na minuta que NÃO aparecem nos autos. */
export function verificarFidelidade(minuta: string, autos: string): Divergencia[] {
  const fonte = extrairDados(autos);
  const fonteNorm = Object.fromEntries(
    (Object.keys(fonte) as TipoDado[]).map((k) => [k, new Set(fonte[k].map(norm))]),
  ) as Record<TipoDado, Set<string>>;
  const naMinuta = extrairDados(minuta);
  const out: Divergencia[] = [];
  (Object.keys(naMinuta) as TipoDado[]).forEach((tipo) => {
    for (const v of naMinuta[tipo]) if (!fonteNorm[tipo].has(norm(v))) out.push({ tipo, valor: v });
  });
  return out;
}

/** Contagem de parágrafos densos (≥ 250 caracteres) — piso contra sentenças telegráficas. */
export function contarParagrafosDensos(texto: string, minChars = 250): number {
  return texto.split(/\n\s*\n/).filter((p) => p.trim().length >= minChars).length;
}
