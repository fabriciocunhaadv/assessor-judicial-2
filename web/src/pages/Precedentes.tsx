import { BookOpen, ChevronLeft, ChevronRight, ClipboardCopy, ExternalLink, Search, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Precedente } from "@shared/schemas";
import { Badge, Button, Card, EmptyState, ErrorBox, inputCls, Notice } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Item = Precedente & { id: string; importadoEm?: number };
const TRIBUNAIS = ["STF", "STJ", "TNU", "TJGO", "GABINETE"] as const;
const POR_PAGINA = 8;
const TIPO: Record<string, string> = { sumula: "Súmula", sumula_vinculante: "Súmula Vinculante", tema_repetitivo: "Tema Repetitivo", repercussao_geral: "Repercussão Geral", informativo: "Informativo", irdr: "IRDR", enunciado: "Enunciado", tese_gabinete: "Tese do gabinete" };
const BASES = [
  { rotulo: "STF — jurisprudência", url: "https://portal.stf.jus.br/" },
  { rotulo: "STJ — súmulas e repetitivos", url: "https://scon.stj.jus.br/SCON/" },
  { rotulo: "TNU (CJF)", url: "https://www.cjf.jus.br/" },
  { rotulo: "TJGO", url: "https://www.tjgo.jus.br/" },
];

/** Repositório vinculante: súmulas, teses e informativos indexados para o gabinete. */
export default function Precedentes() {
  const { pode } = useAuth();
  const [itens, setItens] = useState<Item[]>([]);
  const [filtro, setFiltro] = useState<string>("TODOS");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [importando, setImportando] = useState(false);
  const [relatorio, setRelatorio] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = () => api.get<Item[]>("/precedentes").then((l) => setItens(l.sort((a, b) => (b.importadoEm ?? 0) - (a.importadoEm ?? 0)))).catch((e) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);
  useEffect(() => setPagina(1), [filtro, q]);

  const contagem = useMemo(() => Object.fromEntries(TRIBUNAIS.map((t) => [t, itens.filter((i) => i.tribunal === t).length])), [itens]);
  const visiveis = useMemo(() => {
    const t = q.trim().toLowerCase();
    return itens.filter((i) => (filtro === "TODOS" || i.tribunal === filtro) && (!t || `${i.identificador} ${i.enunciado} ${i.palavrasChave.join(" ")}`.toLowerCase().includes(t)));
  }, [itens, filtro, q]);
  const paginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  const trecho = visiveis.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  async function importar(file?: File) {
    if (!file) return;
    setErro(null); setRelatorio(null); setImportando(true);
    try {
      const r = await api.upload<{ paginas: number; blocos: number; blocosComFalha: number[]; indexados: number }>("/precedentes/importar", file);
      setRelatorio(`${file.name}: ${r.paginas} páginas em ${r.blocos} blocos → ${r.indexados} julgados indexados.` + (r.blocosComFalha.length ? ` Blocos com falha: ${r.blocosComFalha.join(", ")}. Envie o arquivo de novo para tentar outra vez (nada é duplicado).` : ""));
      await carregar();
    } catch (e) { setErro((e as Error).message); } finally { setImportando(false); }
  }
  async function copiar(p: Item) {
    try { await navigator.clipboard.writeText(`${p.tribunal} — ${TIPO[p.tipo] ?? p.tipo} ${p.identificador}: "${p.enunciado}"`); setCopiado(p.id); setTimeout(() => setCopiado(null), 1500); } catch { /* sem permissão */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">Súmulas, Teses e Informativos <span className="text-sm font-normal text-slate-500">STF · STJ · TNU · TJGO</span></h1>
          <p className="text-sm text-slate-500">Repositório indexado do gabinete. Os precedentes pertinentes ao tema de cada processo entram automaticamente na redação da minuta.</p>
        </div>
        {pode("precedentes:importar") && (
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 ${importando ? "pointer-events-none opacity-60" : ""}`}>
            <Upload className="h-4 w-4" /> {importando ? "Importando e indexando…" : "Anexar PDF de informativo / súmulas"}
            <input type="file" accept="application/pdf" className="hidden" disabled={importando} onChange={(e) => void importar(e.target.files?.[0])} />
          </label>
        )}
      </div>

      <Notice tone="ok"><Sparkles className="mr-1 inline h-4 w-4" /><strong>Execução automática:</strong> a cada minuta, o sistema cruza os pedidos e os pontos controvertidos do processo com este repositório e injeta as súmulas e teses aplicáveis, sem custo de pesquisa externa.</Notice>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Bases oficiais:</span>
        {BASES.map((b) => <a key={b.url} href={b.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-slate-600 hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300">{b.rotulo}<ExternalLink className="h-3 w-3" /></a>)}
      </div>

      {relatorio && <Notice tone={relatorio.includes("falha") ? "warn" : "ok"}>{relatorio}</Notice>}
      <ErrorBox erro={erro} />

      <Card bodyClass="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar índice (ex.: energia elétrica, Súmula 479, Tema 1.061)" className={`${inputCls} pl-9`} />
          </div>
          {["TODOS", ...TRIBUNAIS].map((t) => (
            <button key={t} type="button" aria-pressed={filtro === t} onClick={() => setFiltro(t)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${filtro === t ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}>
              {t === "TODOS" ? "Todos os tribunais" : t === "GABINETE" ? "Gabinete" : t}
              <span className="rounded-full bg-black/10 px-1.5 tabular-nums dark:bg-white/10">{t === "TODOS" ? itens.length : contagem[t]}</span>
            </button>
          ))}
        </div>

        {trecho.length ? (
          <div className="space-y-3">
            {trecho.map((p) => (
              <article key={p.id} className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">{TIPO[p.tipo] ?? p.tipo} · {p.identificador}</span>
                    <Badge tone="green">{p.tribunal}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void copiar(p)}><ClipboardCopy className="h-3.5 w-3.5" /> {copiado === p.id ? "Copiada" : "Copiar ementa"}</Button>
                </div>
                <blockquote className="rounded-md bg-slate-50 px-4 py-3 font-serif text-[15px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">“{p.enunciado}”</blockquote>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="flex flex-wrap gap-1.5">{p.palavrasChave.map((k) => <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">#{k}</span>)}</span>
                  {p.fonte && <span>Fonte: {p.fonte}</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={<BookOpen className="h-6 w-6" />} title={itens.length ? "Nada encontrado com esse filtro" : "Repositório vazio"}>
            {itens.length ? "Mude o tribunal ou os termos da pesquisa." : "Anexe PDFs de informativos, cadernos de súmulas ou teses (STF, STJ, TNU, TJGO). O Claude lê cada bloco e indexa os julgados para todo o gabinete."}
          </EmptyState>
        )}

        {visiveis.length > POR_PAGINA && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800">
            <span>Mostrando {(pagina - 1) * POR_PAGINA + 1} a {Math.min(pagina * POR_PAGINA, visiveis.length)} de {visiveis.length}</span>
            <span className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="tabular-nums">{pagina} / {paginas}</span>
              <Button size="sm" variant="ghost" disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
