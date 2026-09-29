import { describe, expect, it } from "vitest";
import { chunkText, mapLimit } from "../server/pipelines/chunking";
import { mergeDossies } from "../server/pipelines/minutePipeline";
import type { DossieFatico } from "../shared/schemas";

describe("chunking", () => {
  it("cobre o texto inteiro, sem perder o final", () => {
    const texto = Array.from({ length: 500 }, (_, i) => `Parágrafo ${i}. Conteúdo relevante.`).join("\n\n");
    const blocos = chunkText(texto, 2_000);
    expect(blocos.length).toBeGreaterThan(5);
    expect(blocos.at(-1)!.endsWith("Parágrafo 499. Conteúdo relevante.")).toBe(true);
    for (let i = 0; i < 500; i += 37) expect(blocos.some((b) => b.includes(`Parágrafo ${i}.`))).toBe(true);
  });

  it("mapLimit preserva a ordem", async () => {
    expect(await mapLimit([3, 1, 2], 2, async (n) => n * 10)).toEqual([30, 10, 20]);
  });
});

describe("fusão de dossiês da Etapa 1", () => {
  const base = (over: Partial<DossieFatico>): DossieFatico => ({
    numeroProcesso: "n/i", classe: "Procedimento Comum", unidade: "1ª Vara", partes: { polo_ativo: [], polo_passivo: [], terceiros: [] },
    cronologia: [], pedidos: [], preliminares: [], provas: [], pontosControvertidos: [], faseProcessual: "concluso_sentenca", atoSugerido: "sentenca", alertas: [], ...over,
  });
  const loc = { mov: "1", arq: "1", pag: "1" };

  it("não funde pedidos de litisconsortes distintos e renumera ids", () => {
    const m = mergeDossies([
      base({ numeroProcesso: "5272040-93.2021.8.09.0115", pedidos: [{ id: "P1", litisconsorte: "Ana", descricao: "Dano moral", valor: "R$ 5.000,00", natureza: "cumulativo", local: loc }] }),
      base({ pedidos: [{ id: "P1", litisconsorte: "Bruno", descricao: "Dano moral", valor: "R$ 5.000,00", natureza: "cumulativo", local: loc }] }),
    ]);
    expect(m.numeroProcesso).toBe("5272040-93.2021.8.09.0115");
    expect(m.pedidos.map((p) => `${p.id}:${p.litisconsorte}`)).toEqual(["P1:Ana", "P2:Bruno"]);
  });
});
