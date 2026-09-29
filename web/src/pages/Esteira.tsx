import { ClipboardCopy, Download, FileText, ListChecks, ScanSearch, Sparkles, SquarePen, Type, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { TIPO_ATO_LABEL, TIPOS_ATO, type TipoAto } from "@shared/gabinete";
import { cleanJudicialText } from "@shared/judicialTextCleaner";
import type { MinutaOutput } from "../../../server/pipelines/minutePipeline";
import { MarkdownLite } from "../components/MarkdownLite";
import { PdfUpload } from "../components/PdfUpload";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Notice, Segmented, Tabs } from "../components/ui";
import { api } from "../lib/api";
import { useCaso } from "../lib/caso";
import { useGabinete } from "../lib/gabinete";

const lerPref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const gravarPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

function GuiaInicio({ fechar }: { fechar(): void }) {
  const passos = [
    ["Anexar os autos", "Arraste o PDF do processo ou cole o texto. Assinaturas, carimbos e cabeçalhos repetidos são removidos."],
    ["Escolher o prompt e o ato", "Selecione o prompt da área e o tipo de minuta, ou deixe em Auto-detectar pela fase processual."],
    ["Minuta Paradigma (opcional)", "No Modo Avançado, vincule um modelo do magistrado para clonar estilo, tópicos e dispositivo."],
    ["Executar e conferir", "Gere a minuta em duas etapas e revise a conferência automática antes de levar à Lupa."],
  ];
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Como iniciar uma análise</p>
        <button type="button" onClick={fechar} aria-label="Fechar guia" className="rounded p-1 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"><X className="h-4 w-4" /></button>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {passos.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">{i + 1}</span>
            <span className="text-sm"><strong className="block text-slate-900 dark:text-slate-100">{t}</strong><span className="text-slate-600 dark:text-slate-300">{d}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Esteira() {
  const { caso, atualizar } = useCaso();
  const { prompts, promptId, setPromptId, paradigmas, teses, unidadeId, unidades } = useGabinete();
  const navigate = useNavigate();
  const [modo, setModo] = useState<"simplificado" | "avancado">(() => (lerPref("assessor.modo", "simplificado") === "avancado" ? "avancado" : "simplificado"));
  const [guia, setGuia] = useState(() => lerPref("assessor.guiaFechado", "") !== "1");
  const [entrada, setEntrada] = useState<"pdf" | "texto">("pdf");
  const [textoColado, setTextoColado] = useState("");
  const [tipoAto, setTipoAto] = useState<TipoAto>("auto");
  const [filtro, setFiltro] = useState("");
  const [verRegras, setVerRegras] = useState(false);
  const [paradigmaId, setParadigmaId] = useState<string>(() => { try { return sessionStorage.getItem("paradigmaInjetado") ?? ""; } catch { return ""; } });
  const [instrucao, setInstrucao] = useState("");
  const [usarTeses, setUsarTeses] = useState(true);
  const [aba, setAba] = useState<"minuta" | "dossie" | "conferencia">("minuta");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const r = caso.resultado;
  const prompt = prompts.find((p) => p.id === promptId);
  const unidade = unidades.find((u) => u.id === unidadeId);
  const promptsFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return q ? prompts.filter((p) => `${p.titulo} ${p.area} ${p.texto}`.toLowerCase().includes(q)) : prompts;
  }, [prompts, filtro]);
  const areas = Array.from(new Set(promptsFiltrados.map((p) => p.area)));

  function usarTexto() {
    if (caso.pdfUrl) URL.revokeObjectURL(caso.pdfUrl);
    atualizar({ nomeArquivo: "Texto colado", pdfUrl: null, autos: cleanJudicialText(textoColado), paginas: 0, minuta: "", resumoExecutivo: "", resultado: null });
  }

  async function gerar() {
    setErro(null);
    setCarregando(true);
    try {
      const res = await api.post<MinutaOutput>("/minutas", {
        autos: caso.autos, tipoAto, unidadeId: unidadeId || null, promptId: promptId || null,
        paradigmaId: modo === "avancado" ? paradigmaId || null : null,
        instrucao: modo === "avancado" ? instrucao : undefined, usarTeses,
      });
      atualizar({ minuta: res.markdown, resumoExecutivo: res.resumoExecutivo, numeroProcesso: res.dossie.numeroProcesso, resultado: res });
      setAba("minuta");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(caso.minuta); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão */ }
  }
  function baixar() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([caso.minuta], { type: "text/markdown;charset=utf-8" }));
    a.download = `minuta-${(caso.numeroProcesso || "processo").replace(/[^\w.-]+/g, "_")}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const v = r?.verificacoes;
  const pendencias = v ? v.pedidosNaoApreciados.length + v.dadosNaoEncontradosNosAutos.length + (v.paragrafosDensos < v.pisoParagrafos ? 1 : 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Nova análise</h1>
          <p className="text-sm text-slate-500">{unidade ? `${unidade.nome} · Comarca de ${unidade.comarca}` : "Nenhuma unidade judiciária cadastrada"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!guia && <Button variant="subtle" size="sm" onClick={() => { setGuia(true); gravarPref("assessor.guiaFechado", ""); }}>Como iniciar</Button>}
          <Segmented label="Modo" value={modo} onChange={(m) => { setModo(m); gravarPref("assessor.modo", m); }} options={[{ value: "simplificado", label: "Modo Simplificado" }, { value: "avancado", label: "Modo Avançado" }]} />
        </div>
      </div>

      {guia && <GuiaInicio fechar={() => { setGuia(false); gravarPref("assessor.guiaFechado", "1"); }} />}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <Card title="Execução de prompts jurídicos" icon={<Sparkles className="h-4 w-4 text-emerald-600" />} bodyClass="space-y-4 p-4"
          actions={<Button variant="ghost" size="sm" onClick={() => navigate("/prompts")}><SquarePen className="h-3.5 w-3.5" /> Editar prompts</Button>}>
          <Field label="Prompt ativo" hint={prompt ? <Badge tone="green">{prompt.area}</Badge> : undefined}>
            {prompts.length > 6 && <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nome ou conteúdo…" className={`${inputCls} mb-2`} />}
            <select value={promptId} onChange={(e) => setPromptId(e.target.value)} className={inputCls}>
              <option value="">Padrão do sistema (sem instruções de área)</option>
              {areas.map((a) => (
                <optgroup key={a} label={a}>
                  {promptsFiltrados.filter((p) => p.area === a).map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          {prompt && (
            <button type="button" onClick={() => setVerRegras(!verRegras)} className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {verRegras ? "Ocultar as regras deste prompt" : "Ver as regras deste prompt"}
              {verRegras && <span className="mt-2 block max-h-48 overflow-auto whitespace-pre-wrap text-slate-700 dark:text-slate-200">{prompt.texto}</span>}
            </button>
          )}

          <Field label="Entrada dos autos">
            <Segmented label="Entrada dos autos" value={entrada} onChange={setEntrada} options={[{ value: "pdf", label: <><FileText className="h-3.5 w-3.5" /> PDF</> }, { value: "texto", label: <><Type className="h-3.5 w-3.5" /> Texto</> }]} />
          </Field>
          {entrada === "pdf" ? (
            <PdfUpload />
          ) : (
            <div className="space-y-2">
              <textarea rows={6} value={textoColado} onChange={(e) => setTextoColado(e.target.value)} className={inputCls} placeholder="Cole aqui o texto dos autos (petição, contestação, decisões…)." />
              <Button variant="ghost" size="sm" disabled={textoColado.trim().length < 200} onClick={usarTexto}>Usar este texto</Button>
              {caso.nomeArquivo === "Texto colado" && <p className="text-xs text-slate-500">{caso.autos.length.toLocaleString("pt-BR")} caracteres prontos para análise.</p>}
            </div>
          )}

          <Field label="Tipo de minuta a redigir" hint={tipoAto === "auto" ? "detecta pela fase processual" : undefined}>
            <Segmented label="Tipo de minuta" value={tipoAto} onChange={setTipoAto} options={TIPOS_ATO.map((t) => ({ value: t, label: TIPO_ATO_LABEL[t] }))} />
          </Field>

          {modo === "avancado" && (
            <div className="space-y-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
              <Field label="Minuta Paradigma (espelho estrutural)">
                <select value={paradigmaId} onChange={(e) => setParadigmaId(e.target.value)} className={inputCls}>
                  <option value="">Sem paradigma</option>
                  {paradigmas.map((p) => <option key={p.id} value={p.id}>{p.titulo} ({p.tipoAto})</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={usarTeses} onChange={(e) => setUsarTeses(e.target.checked)} className="accent-emerald-600" />
                Aplicar o Caderno de Teses ({teses.filter((t) => t.ativa !== false).length} ativas)
              </label>
              <Field label="Orientação para este caso">
                <textarea rows={3} value={instrucao} onChange={(e) => setInstrucao(e.target.value)} className={inputCls} placeholder="Ex.: examinar a impugnação da assinatura do contrato (Tema 1.061/STJ)." />
              </Field>
            </div>
          )}

          <Button onClick={gerar} loading={carregando} disabled={!caso.autos} className="w-full py-2.5">
            {!carregando && <Sparkles className="h-4 w-4" />} {carregando ? "Analisando os autos…" : "Gerar análise e minuta"}
          </Button>
          {carregando && <p className="text-xs text-slate-500">Etapa 1: o Assessor Fático extrai cronologia, pedidos e provas. Etapa 2: o Juiz Revisor redige a minuta. Autos volumosos podem levar alguns minutos.</p>}
          <ErrorBox erro={erro} />
        </Card>

        <Card title="Resultado & Análise" icon={<ListChecks className="h-4 w-4 text-emerald-600" />} bodyClass="p-0"
          actions={caso.minuta && (
            <>
              <Button variant="ghost" size="sm" onClick={copiar}><ClipboardCopy className="h-3.5 w-3.5" /> {copiado ? "Copiado" : "Copiar"}</Button>
              <Button variant="ghost" size="sm" onClick={baixar}><Download className="h-3.5 w-3.5" /> Baixar</Button>
              <Button variant="dark" size="sm" onClick={() => navigate("/lupa")}><ScanSearch className="h-3.5 w-3.5" /> Conferir na Lupa</Button>
            </>
          )}>
          {caso.minuta ? (
            <div>
              <div className="px-4 pt-2">
                <Tabs value={aba} onChange={setAba} tabs={[
                  { value: "minuta", label: r ? `Minuta · ${TIPO_ATO_LABEL[r.tipoAto]}` : "Minuta" },
                  ...(r ? [{ value: "dossie" as const, label: "Dossiê fático" }, { value: "conferencia" as const, label: "Conferência", count: pendencias }] : []),
                ]} />
              </div>
              <div className="max-h-[75vh] overflow-auto p-5">
                {aba === "minuta" && <MarkdownLite text={caso.minuta} />}
                {aba === "dossie" && r && (
                  <div className="space-y-4 text-sm">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Info rotulo="Processo" valor={r.dossie.numeroProcesso} />
                      <Info rotulo="Classe" valor={r.dossie.classe} />
                      <Info rotulo="Fase" valor={r.dossie.faseProcessual.replace(/_/g, " ")} />
                    </div>
                    <Secao titulo={`Pedidos (${r.dossie.pedidos.length})`}>
                      {r.dossie.pedidos.map((p) => <li key={p.id}><strong>{p.id}</strong> · {p.litisconsorte}: {p.descricao}{p.valor ? ` — ${p.valor}` : ""} <Ref l={p.local} /></li>)}
                    </Secao>
                    <Secao titulo={`Cronologia (${r.dossie.cronologia.length})`}>
                      {r.dossie.cronologia.map((e, i) => <li key={i}><span className="font-mono text-xs text-slate-500">{e.data}</span> · {e.tipo.replace(/_/g, " ")}: {e.resumo} <Ref l={e.local} /></li>)}
                    </Secao>
                    {r.dossie.pontosControvertidos.length > 0 && <Secao titulo="Pontos controvertidos">{r.dossie.pontosControvertidos.map((p) => <li key={p}>{p}</li>)}</Secao>}
                  </div>
                )}
                {aba === "conferencia" && r && v && (
                  <div className="space-y-3 text-sm">
                    <Linha rotulo={v.pisoParagrafos ? `Parágrafos densos na fundamentação (mínimo ${v.pisoParagrafos})` : "Parágrafos densos na fundamentação"} valor={v.paragrafosDensos} ok={v.paragrafosDensos >= v.pisoParagrafos} />
                    <Linha rotulo="Pedidos não apreciados" valor={v.pedidosNaoApreciados.length} ok={!v.pedidosNaoApreciados.length} />
                    <Linha rotulo="Dados sem lastro nos autos" valor={v.dadosNaoEncontradosNosAutos.length} ok={!v.dadosNaoEncontradosNosAutos.length} />
                    {[...v.pedidosNaoApreciados, ...v.dadosNaoEncontradosNosAutos.map((d) => `${d.tipo}: ${d.valor} não aparece nos autos`)].map((x) => <p key={x} className="text-rose-700 dark:text-rose-300">• {x}</p>)}
                    {r.dossie.alertas.length > 0 && <Notice tone="warn"><strong>Alertas do Assessor Fático:</strong> {r.dossie.alertas.join(" · ")}</Notice>}
                    <p className="text-xs text-slate-500">Modelos: {r.modelos.etapa1} → {r.modelos.etapa2}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState icon={<Sparkles className="h-6 w-6" />} title={carregando ? "Analisando os autos…" : "Aguardando execução"}>
              Preencha os dados ou insira o PDF e execute o prompt para ver aqui o relatório estruturado e a minuta.
            </EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

function Ref({ l }: { l: { mov: string; arq: string; pag: string } }) {
  return <span className="whitespace-nowrap rounded bg-amber-50 px-1 font-mono text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">Mov. {l.mov} · Arq. {l.arq} · Pág. {l.pag}</span>;
}
function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950"><p className="text-xs text-slate-500">{rotulo}</p><p className="font-medium text-slate-900 dark:text-slate-100">{valor}</p></div>;
}
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div><h3 className="mb-1.5 font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3><ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">{children}</ul></div>;
}
function Linha({ rotulo, valor, ok }: { rotulo: string; valor: number; ok: boolean }) {
  return <div className="flex items-center justify-between gap-2"><span>{rotulo}</span><Badge tone={ok ? "green" : "red"}>{valor}</Badge></div>;
}
