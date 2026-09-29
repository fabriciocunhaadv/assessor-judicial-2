import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MinutaOutput } from "../../../server/pipelines/minutePipeline";

/** Processo em trabalho — compartilhado entre Esteira, Lupa, Chat e Audiência. */
export interface Caso {
  nomeArquivo: string;
  pdfUrl: string | null;
  autos: string;
  paginas: number;
  resumoExecutivo: string;
  minuta: string;
  numeroProcesso: string;
  /** Último resultado completo da esteira (dossiê, conferência). Só em memória. */
  resultado: MinutaOutput | null;
}

const vazio: Caso = { nomeArquivo: "", pdfUrl: null, autos: "", paginas: 0, resumoExecutivo: "", minuta: "", numeroProcesso: "", resultado: null };
const RASCUNHO = "assessor.rascunho.v1";

const Ctx = createContext<{ caso: Caso; atualizar(p: Partial<Caso>): void; novoCaso(): void } | null>(null);

export function CasoProvider({ children }: { children: ReactNode }) {
  const [caso, setCaso] = useState<Caso>(() => {
    try {
      const salvo = localStorage.getItem(RASCUNHO);
      return salvo ? { ...vazio, ...JSON.parse(salvo), pdfUrl: null, resultado: null } : vazio;
    } catch {
      return vazio;
    }
  });

  // Rascunho local da minuta e do resumo (sem os autos, que podem ser grandes e sigilosos).
  useEffect(() => {
    try {
      const { minuta, resumoExecutivo, numeroProcesso, nomeArquivo } = caso;
      localStorage.setItem(RASCUNHO, JSON.stringify({ minuta, resumoExecutivo, numeroProcesso, nomeArquivo }));
    } catch {
      /* armazenamento indisponível: segue sem rascunho */
    }
  }, [caso.minuta, caso.resumoExecutivo, caso.numeroProcesso, caso.nomeArquivo]);

  return (
    <Ctx.Provider
      value={{
        caso,
        atualizar: (p) => setCaso((c) => ({ ...c, ...p })),
        novoCaso: () => {
          if (caso.pdfUrl) URL.revokeObjectURL(caso.pdfUrl);
          setCaso(vazio);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCaso() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCaso fora do CasoProvider");
  return v;
}
