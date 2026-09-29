import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

export interface Unidade { id: string; nome: string; comarca: string; competencia: string; ativa: boolean }
export interface PromptGabinete { id: string; titulo: string; area: string; texto: string; ativo: boolean }
export interface Paradigma { id: string; titulo: string; tipoAto: string; texto: string }
export interface Tese { id: string; titulo: string; texto: string; ativa: boolean }
export interface Comunicado { texto: string; nivel: "info" | "alerta" }

interface GabineteState {
  unidades: Unidade[];
  prompts: PromptGabinete[];
  paradigmas: Paradigma[];
  teses: Tese[];
  comunicados: { global: Comunicado | null; gabinete: Comunicado | null };
  unidadeId: string;
  promptId: string;
  setUnidadeId(id: string): void;
  setPromptId(id: string): void;
  recarregar(): Promise<void>;
}

const Ctx = createContext<GabineteState | null>(null);
const ler = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

/** Dados do gabinete usados em toda a interface + preferências do usuário (unidade e prompt ativos). */
export function GabineteProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [prompts, setPrompts] = useState<PromptGabinete[]>([]);
  const [paradigmas, setParadigmas] = useState<Paradigma[]>([]);
  const [teses, setTeses] = useState<Tese[]>([]);
  const [comunicados, setComunicados] = useState<GabineteState["comunicados"]>({ global: null, gabinete: null });
  const chave = (k: string) => `assessor.${perfil?.uid ?? "anon"}.${k}`;
  const [unidadeId, setU] = useState("");
  const [promptId, setP] = useState("");

  const recarregar = useCallback(async () => {
    if (!perfil) return;
    const pode = perfil.permissoes.includes("minuta:gerar");
    const [u, p, pa, t, c] = await Promise.all([
      api.get<Unidade[]>("/gabinete/unidades").catch(() => []),
      pode ? api.get<PromptGabinete[]>("/gabinete/prompts").catch(() => []) : Promise.resolve([]),
      pode ? api.get<Paradigma[]>("/gabinete/paradigmas").catch(() => []) : Promise.resolve([]),
      pode ? api.get<Tese[]>("/gabinete/teses").catch(() => []) : Promise.resolve([]),
      api.get<GabineteState["comunicados"]>("/comunicados").catch(() => ({ global: null, gabinete: null })),
    ]);
    const porNome = <T extends { titulo?: string; nome?: string }>(a: T[]) => [...a].sort((x, y) => (x.titulo ?? x.nome ?? "").localeCompare(y.titulo ?? y.nome ?? ""));
    setUnidades(porNome(u)); setPrompts(porNome(p.filter((x) => x.ativo !== false))); setParadigmas(porNome(pa)); setTeses(porNome(t)); setComunicados(c);
  }, [perfil]);

  useEffect(() => {
    if (!perfil) return;
    setU(ler(chave("unidade"))); setP(ler(chave("prompt")));
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, recarregar]);

  // Mantém seleções válidas quando as listas mudam.
  useEffect(() => { if (unidades.length && !unidades.some((u) => u.id === unidadeId)) setU(unidades[0].id); }, [unidades, unidadeId]);
  useEffect(() => { if (promptId && prompts.length && !prompts.some((p) => p.id === promptId)) setP(""); }, [prompts, promptId]);

  return (
    <Ctx.Provider value={{
      unidades, prompts, paradigmas, teses, comunicados, unidadeId, promptId, recarregar,
      setUnidadeId: (id) => { setU(id); gravar(chave("unidade"), id); },
      setPromptId: (id) => { setP(id); gravar(chave("prompt"), id); },
    }}>{children}</Ctx.Provider>
  );
}

export function useGabinete() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGabinete fora do GabineteProvider");
  return v;
}
