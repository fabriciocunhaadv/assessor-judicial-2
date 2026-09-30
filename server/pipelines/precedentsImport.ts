import { createHash } from "node:crypto";
import { LotePrecedentes, type Precedente } from "../../shared/schemas.js";
import { PRECEDENTS_SYSTEM } from "../ai/prompts/precedentsIndexer.js";
import type { AuthUser } from "../middleware/requireAuth.js";
import type { PrecedenteSalvo } from "../repositories/types.js";
import { generateValidated, schemaText } from "../services/llmJson.js";
import { chunkText, mapLimit } from "./chunking.js";

/** ≈ 8–10 páginas de informativo por bloco: pequeno o bastante para a IA não omitir julgados. */
const BLOCO = 30_000;

export function precedenteId(p: Precedente): string {
  const base = `${p.tribunal}|${p.tipo}|${p.identificador.toLowerCase().replace(/\s+/g, " ")}|${p.enunciado.slice(0, 200).toLowerCase()}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 24);
}

export interface ResultadoImportacao {
  blocos: number;
  blocosComFalha: number[];
  itens: PrecedenteSalvo[];
}

/**
 * Importador de PDFs de informativos/cadernos (centenas de páginas):
 * extração em blocos paralelos com concorrência limitada, deduplicação por hash e
 * relatório de blocos com falha (nenhum bloco é descartado em silêncio).
 */
export async function importarPrecedentes(user: AuthUser, texto: string, fonte: string, onProgress?: (feitos: number, total: number) => void): Promise<ResultadoImportacao> {
  const blocos = chunkText(texto, BLOCO);
  const schema = schemaText(LotePrecedentes);
  const falhas: number[] = [];
  let feitos = 0;

  const lotes = await mapLimit(blocos, 4, async (b, i) => {
    try {
      const { data } = await generateValidated(user, "precedentes", LotePrecedentes, {
        system: PRECEDENTS_SYSTEM,
        documento: { rotulo: "trecho", texto: b },
        messages: [{ role: "user", content: `Documento: "${fonte}" — bloco ${i + 1} de ${blocos.length} (trecho acima).\n\nSCHEMA:\n${schema}` }],
        esforco: "medium",
      });
      return data.itens;
    } catch (err) {
      console.error(`[precedentes] bloco ${i + 1} falhou`, err);
      falhas.push(i + 1);
      return [];
    } finally {
      onProgress?.(++feitos, blocos.length);
    }
  });

  const porId = new Map<string, PrecedenteSalvo>();
  for (const p of lotes.flat()) {
    const id = precedenteId(p);
    if (!porId.has(id)) porId.set(id, { ...p, fonte: p.fonte ?? fonte, id, importadoEm: Date.now(), importadoPor: user.uid });
  }
  return { blocos: blocos.length, blocosComFalha: falhas.sort((a, b) => a - b), itens: [...porId.values()] };
}
