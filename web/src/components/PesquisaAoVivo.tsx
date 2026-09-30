import { ExternalLink, Globe, Search } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { MarkdownLite } from "./MarkdownLite";
import { Button, Card, ClaudeTag, ErrorBox, inputCls } from "./ui";

interface Resultado { resposta: string; fontes: { url: string; titulo: string; trecho: string }[]; buscas: number; modelo: string }

/** Pesquisa ao vivo com a busca na web do Claude, restrita a sites oficiais (substitui o grounding do Google). */
export function PesquisaAoVivo({ tipo, exemplo }: { tipo: "jurisprudencia" | "legislacao"; exemplo: string }) {
  const [consulta, setConsulta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [r, setR] = useState<Resultado | null>(null);

  async function pesquisar() {
    setErro(null); setCarregando(true);
    try { setR(await api.post<Resultado>("/pesquisa", { consulta, tipo })); } catch (e) { setErro((e as Error).message); } finally { setCarregando(false); }
  }

  return (
    <Card title={<span className="flex items-center gap-2">Pesquisa ao vivo com o Claude <span className="claude-chip">fontes oficiais</span></span>} icon={<Globe className="h-4 w-4" />} bodyClass="space-y-3 p-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (consulta.trim().length >= 3) void pesquisar(); }}>
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder={exemplo} className={`${inputCls} pl-9`} />
        </div>
        <Button type="submit" loading={carregando} disabled={consulta.trim().length < 3}>Pesquisar</Button>
      </form>
      <p className="text-xs text-stone-500">{tipo === "legislacao" ? "Consulta somente planalto.gov.br, Câmara, Senado, STF e STJ." : "Consulta somente STF, STJ, CJF/TNU, TJGO e CNJ."} Confira sempre a fonte antes de citar.</p>
      <ErrorBox erro={erro} />
      {r && (
        <div className="space-y-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <div className="claude-output space-y-2"><ClaudeTag modelo={r.modelo}>Pesquisa feita pelo Claude</ClaudeTag><MarkdownLite text={r.resposta} /></div>
          {r.fontes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Fontes consultadas</p>
              <ul className="space-y-1 text-sm">{r.fontes.map((f) => (
                <li key={f.url}><a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-clay-700 hover:underline dark:text-clay-300">{f.titulo}<ExternalLink className="h-3 w-3 shrink-0" /></a></li>
              ))}</ul>
            </div>
          )}
          <p className="text-xs text-stone-400">{r.buscas} busca(s) · {r.modelo}</p>
        </div>
      )}
    </Card>
  );
}
