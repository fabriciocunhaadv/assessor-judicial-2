import type { PrecedenteSalvo } from "../repositories/types.js";

const STOP = new Set("a o as os de da do das dos e em no na nos nas por para com sem que se um uma ao aos à às pelo pela é art lei".split(" "));

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/**
 * Busca contextual: pontua precedentes pela sobreposição de palavras-chave com o tema do caso
 * (pedidos + pontos controvertidos). Palavras-chave cadastradas valem 3x; enunciado vale 1x.
 */
export function rankPrecedentes(contexto: string, base: PrecedenteSalvo[], limite = 12): PrecedenteSalvo[] {
  const ctx = new Set(tokens(contexto));
  return base
    .map((p) => {
      const kw = p.palavrasChave.flatMap(tokens);
      const en = tokens(p.enunciado);
      const score = kw.filter((t) => ctx.has(t)).length * 3 + new Set(en.filter((t) => ctx.has(t))).size;
      return { p, score };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map((x) => x.p);
}
