import { orchestrator } from "../ai/index.js";
import { SYNOPSIS_MERGE_SYSTEM, SYNOPSIS_SYSTEM } from "../ai/prompts/synopsis.js";
import type { AuthUser } from "../middleware/requireAuth.js";
import { registrarUso } from "../services/usage.js";
import { chunkText, mapLimit } from "./chunking.js";

/** Mesmo corte da Etapa 1: autos até esse tamanho vão num bloco só. */
const BLOCO = 900_000;

/**
 * Resumo Executivo dos Autos: gerado uma vez por processo e reutilizado no Chat e na Lupa,
 * em vez de reenviar centenas de milhares de caracteres a cada mensagem.
 */
export async function gerarResumoExecutivo(user: AuthUser, autos: string): Promise<string> {
  const blocos = chunkText(autos, BLOCO);
  const parciais = await mapLimit(blocos, 3, async (b, i) => {
    const r = await orchestrator.generate({
      system: SYNOPSIS_SYSTEM,
      documento: { rotulo: "autos", texto: b },
      messages: [{ role: "user", content: `${blocos.length > 1 ? `Bloco ${i + 1} de ${blocos.length}. ` : ""}Elabore o Resumo Executivo dos autos acima.` }],
      esforco: "medium",
      maxOutputTokens: 16_000,
    });
    await registrarUso(user, "sinopse", r);
    return r.text;
  });
  if (parciais.length === 1) return parciais[0];

  const r = await orchestrator.generate({
    system: SYNOPSIS_MERGE_SYSTEM,
    messages: [{ role: "user", content: parciais.map((p, i) => `<resumo_parcial n="${i + 1}">\n${p}\n</resumo_parcial>`).join("\n\n") }],
    esforco: "medium",
    maxOutputTokens: 24_000,
  });
  await registrarUso(user, "sinopse", r);
  return r.text;
}
