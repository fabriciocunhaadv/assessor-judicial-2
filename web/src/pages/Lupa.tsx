import { ClipboardList, FileSearch, FileUp, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DiagnosticoAuditoria } from "@shared/schemas";
import { cleanJudicialText } from "@shared/judicialTextCleaner";
import { MarkdownLite } from "../components/MarkdownLite";
import { Badge, Button, Card, ClaudeTag, EmptyState, ErrorBox, Field, inputCls, Notice, Segmented, Tabs } from "../components/ui";
import { api } from "../lib/api";
import { useCaso } from "../lib/caso";
import { useGabinete } from "../lib/gabinete";
import { extrairTextoPdf } from "../lib/pdf";

interface Resposta { id: string; numeroProcesso: string; diagnostico: DiagnosticoAuditoria; divergenciasAutomaticas: { tipo: string; valor: string }[]; modelo: string }
interface Registro { id: string; numeroProcesso: string; assessorNome: string; nota: number; pendencias: number; criadoEm: number; diagnostico: DiagnosticoAuditoria & { divergenciasAutomaticas?: { tipo: string; valor: string }[] } }

const tomNota = (n: number): "green" | "amber" | "red" => (n >= 8 ? "green" : n >= 6 ? "amber" : "red");

/** Lupa do Magistrado & Auditor de Minutas. */
export default function Lupa() {
  const [aba, setAba] = useState<"bancada" | "nova" | "auditados">("bancada");
  const [aberto, setAberto] = useState<Registro | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><ShieldCheck className="h-5 w-5" /></div>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-stone-900 dark:text-white">Lupa do Magistrado & Auditor de Minutas <Badge tone="amber">Função de ouro</Badge></h1>
          <p className="text-sm text-stone-500">Conformidade fático-probatória, congruência de pedidos e registro das minutas auditadas.</p>
        </div>
      </div>
      <Tabs value={aba} onChange={(a) => { setAba(a); setAberto(null); }} tabs={[
        { value: "bancada", label: <><FileSearch className="h-4 w-4" /> Bancada de Tripla Conferência</> },
        { value: "nova", label: <><ClipboardList className="h-4 w-4" /> Nova auditoria</> },
        { value: "auditados", label: "Processos auditados" },
      ]} />
      {aba === "bancada" && <Bancada />}
      {aba === "nova" && <NovaAuditoria />}
      {aba === "auditados" && (aberto ? <RegistroAberto r={aberto} voltar={() => setAberto(null)} /> : <Auditados abrir={setAberto} />)}
    </div>
  );
}

/** Três painéis: autos | minuta do assessor | diagnóstico e gabarito. */
function Bancada() {
  const { caso, atualizar } = useCaso();
  const { promptId } = useGabinete();
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState<string | undefined>();
  const [r, setR] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ocorrencias = useMemo(() => {
    if (busca.trim().length < 3) return [];
    const out: { pag: string; trecho: string }[] = [];
    const re = new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(caso.autos)) && out.length < 50) {
      const antes = caso.autos.lastIndexOf("⟦Pág.", m.index);
      const pag = antes >= 0 ? caso.autos.slice(antes + 6, caso.autos.indexOf("⟧", antes)) : "?";
      out.push({ pag, trecho: caso.autos.slice(Math.max(0, m.index - 80), m.index + 120).replace(/⟦Pág\. \d+⟧/g, "") });
    }
    return out;
  }, [busca, caso.autos]);

  async function auditar() {
    setErro(null); setCarregando(true);
    try {
      setR(await api.post<Resposta>("/lupa/auditar", { minuta: caso.minuta, autos: caso.resumoExecutivo || caso.autos, autosIntegrais: caso.autos, promptId: promptId || null, numeroProcesso: caso.numeroProcesso || undefined }));
    } catch (e) { setErro((e as Error).message); } finally { setCarregando(false); }
  }

  return (
    <div className="grid gap-3 xl:h-[calc(100vh-15rem)] xl:grid-cols-3">
      <Card title="1 · Autos" className="flex min-h-0 flex-col" bodyClass="flex min-h-0 flex-1 flex-col gap-2 p-3" actions={<div className="relative"><Search className="absolute left-2 top-2 h-4 w-4 text-stone-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nos autos" className="w-44 rounded-md border border-stone-300 bg-transparent py-1 pl-7 pr-2 text-sm dark:border-stone-700" /></div>}>
        {ocorrencias.length > 0 && (
          <ul className="max-h-36 space-y-1 overflow-auto text-xs">
            {ocorrencias.map((o, i) => <li key={i}><button type="button" onClick={() => setPagina(o.pag)} className="text-left hover:underline"><Badge>Pág. {o.pag}</Badge> …{o.trecho}…</button></li>)}
          </ul>
        )}
        {caso.pdfUrl ? <iframe key={pagina} title="Autos" src={`${caso.pdfUrl}${pagina ? `#page=${pagina}` : ""}`} className="min-h-[60vh] w-full flex-1 rounded border-0" />
          : caso.autos ? <pre className="min-h-[60vh] flex-1 overflow-auto whitespace-pre-wrap font-serif text-sm">{caso.autos}</pre>
          : <EmptyState icon={<FileUp className="h-6 w-6" />} title="Sem autos abertos">Carregue os autos em Nova Análise ou use a aba Nova auditoria.</EmptyState>}
      </Card>
      <Card title="2 · Minuta do assessor" className="flex min-h-0 flex-col" bodyClass="flex min-h-0 flex-1 flex-col gap-2 p-3" actions={<Button onClick={auditar} loading={carregando} disabled={!caso.minuta.trim() || !(caso.autos || caso.resumoExecutivo)}>Auditar</Button>}>
        <textarea value={caso.minuta} onChange={(e) => atualizar({ minuta: e.target.value })} placeholder="Cole a minuta a conferir ou gere uma em Nova Análise." className={`${inputCls} min-h-[60vh] flex-1 font-serif`} />
        <ErrorBox erro={erro} />
      </Card>
      <Card title="3 · Diagnóstico e gabarito" className="flex min-h-0 flex-col" bodyClass="min-h-0 flex-1 overflow-auto p-3" actions={r && <><ClaudeTag modelo={r.modelo}>Auditado pelo Claude</ClaudeTag><Badge tone={tomNota(r.diagnostico.nota)}>Nota {r.diagnostico.nota.toFixed(1)}</Badge></>}>
        {r ? <Diagnostico d={r.diagnostico} divergencias={r.divergenciasAutomaticas} usarGabarito={(t) => atualizar({ minuta: t })} />
          : <p className="text-sm text-stone-500">A Matriz de Conformidade verifica adstrição (extra, ultra e citra petita), dados sem lastro nos autos, precedentes vinculantes e consectários. Cada auditoria fica salva em Processos auditados.</p>}
      </Card>
    </div>
  );
}

function NovaAuditoria() {
  const { prompts, promptId } = useGabinete();
  const [diretriz, setDiretriz] = useState(promptId);
  const [numero, setNumero] = useState("");
  const [assessor, setAssessor] = useState("");
  const [minuta, setMinuta] = useState("");
  const [entrada, setEntrada] = useState<"pdf" | "texto">("pdf");
  const [autos, setAutos] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [progresso, setProgresso] = useState<string | null>(null);
  const [ponto, setPonto] = useState("");
  const [r, setR] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function lerPdf(f?: File) {
    if (!f) return;
    setErro(null);
    try {
      const { texto } = await extrairTextoPdf(f, (p, t) => setProgresso(`Lendo página ${p} de ${t}…`));
      setAutos(texto); setArquivo(f.name);
    } catch (e) { setErro(`Não foi possível ler o PDF: ${(e as Error).message}`); } finally { setProgresso(null); }
  }
  async function auditar() {
    setErro(null); setCarregando(true); setR(null);
    try {
      setR(await api.post<Resposta>("/lupa/auditar", { minuta, autos, autosIntegrais: autos, promptId: diretriz || null, numeroProcesso: numero || undefined, assessorNome: assessor || undefined, pontoAtencao: ponto || undefined }));
    } catch (e) { setErro((e as Error).message); } finally { setCarregando(false); }
  }

  if (r) {
    return (
      <Card title={`Resultado · ${r.numeroProcesso}`} actions={<><Badge tone={tomNota(r.diagnostico.nota)}>Nota {r.diagnostico.nota.toFixed(1)}</Badge><Button size="sm" variant="ghost" onClick={() => setR(null)}>Nova auditoria</Button></>}>
        <Notice tone="ok">Auditoria salva em Processos auditados.</Notice>
        <div className="mt-4"><Diagnostico d={r.diagnostico} divergencias={r.divergenciasAutomaticas} /></div>
      </Card>
    );
  }

  return (
    <Card bodyClass="space-y-4 p-4">
      <Notice>Insira a minuta e os autos. O sistema confronta os fatos e as provas, confere a congruência com os pedidos e salva o relatório.</Notice>
      <Field label="Diretriz padrão (prompt)" hint="usada para compor a minuta gabarito">
        <select className={inputCls} value={diretriz} onChange={(e) => setDiretriz(e.target.value)}>
          <option value="">Padrão do sistema</option>
          {prompts.map((p) => <option key={p.id} value={p.id}>{p.area} — {p.titulo}</option>)}
        </select>
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Número do processo" hint="opcional, detectado automaticamente"><input className={`${inputCls} font-mono`} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0000000-00.0000.0.00.0000" /></Field>
        <Field label="Nome do(a) assessor(a)" hint="opcional"><input className={inputCls} value={assessor} onChange={(e) => setAssessor(e.target.value)} /></Field>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="1. Minuta elaborada pelo assessor" hint={`${minuta.length.toLocaleString("pt-BR")} caracteres`}>
          <textarea rows={12} className={`${inputCls} font-serif`} value={minuta} onChange={(e) => setMinuta(e.target.value)} placeholder="Cole aqui o texto corrido da minuta (relatório, fundamentação e dispositivo)." />
        </Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">2. Autos do processo</span>
            <Segmented label="Entrada dos autos" value={entrada} onChange={setEntrada} options={[{ value: "pdf", label: "PDF" }, { value: "texto", label: "Colar texto" }]} />
          </div>
          {entrada === "pdf" ? (
            <label className="flex min-h-[15.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 p-4 text-center text-sm text-stone-600 hover:border-clay-500 dark:border-stone-700 dark:text-stone-300">
              <FileUp className="h-6 w-6" />
              {progresso ?? (arquivo ? <span><strong>{arquivo}</strong> · {autos.length.toLocaleString("pt-BR")} caracteres. Clique para trocar.</span> : <span><strong>Clique ou arraste o PDF oficial dos autos</strong><br />Petições, contestação, réplica, certidões e provas.</span>)}
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => void lerPdf(e.target.files?.[0])} />
            </label>
          ) : (
            <textarea rows={11} className={inputCls} value={autos} onChange={(e) => setAutos(e.target.value)} onBlur={() => setAutos((t) => cleanJudicialText(t))} placeholder="Cole o texto dos autos." />
          )}
        </div>
      </div>
      <Field label="Diretriz ou ponto de atenção do(a) juiz(a)" hint="opcional">
        <textarea rows={3} className={inputCls} value={ponto} onChange={(e) => setPonto(e.target.value)} placeholder="Ex.: conferir se o pedido de tutela de urgência foi apreciado e se os juros seguem a Lei 14.905/2024." />
      </Field>
      <Button loading={carregando} disabled={minuta.trim().length < 100 || autos.trim().length < 100} onClick={auditar} className="w-full py-2.5">
        <ShieldCheck className="h-4 w-4" /> {carregando ? "Auditando a minuta…" : "Executar auditoria"}
      </Button>
      <ErrorBox erro={erro} />
    </Card>
  );
}

function Auditados({ abrir }: { abrir(r: Registro): void }) {
  const [itens, setItens] = useState<Registro[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { api.get<Registro[]>("/lupa/auditorias").then(setItens).catch((e) => setErro(e.message)); }, []);
  return (
    <Card bodyClass="divide-y divide-stone-100 dark:divide-stone-800">
      <ErrorBox erro={erro} />
      {itens === null ? <p className="p-4 text-sm text-stone-500">Carregando…</p> : itens.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Nenhum processo auditado">Cada auditoria feita na Bancada ou em Nova auditoria aparece aqui, com a nota e as pendências.</EmptyState>
      ) : itens.map((a) => (
        <button key={a.id} type="button" onClick={() => abrir(a)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50">
          <span><span className="block font-mono text-sm font-medium text-stone-900 dark:text-stone-100">{a.numeroProcesso}</span><span className="text-xs text-stone-500">{a.assessorNome ? `${a.assessorNome} · ` : ""}{new Date(a.criadoEm).toLocaleString("pt-BR")}</span></span>
          <span className="flex items-center gap-2"><Badge tone={a.pendencias ? "red" : "green"}>{a.pendencias} pendência(s)</Badge><Badge tone={tomNota(a.nota)}>Nota {a.nota.toFixed(1)}</Badge></span>
        </button>
      ))}
    </Card>
  );
}

function RegistroAberto({ r, voltar }: { r: Registro; voltar(): void }) {
  return (
    <Card title={`${r.numeroProcesso}${r.assessorNome ? ` · ${r.assessorNome}` : ""}`} actions={<><Badge tone={tomNota(r.nota)}>Nota {r.nota.toFixed(1)}</Badge><Button size="sm" variant="ghost" onClick={voltar}>Voltar à lista</Button></>}>
      <Diagnostico d={r.diagnostico} divergencias={r.diagnostico.divergenciasAutomaticas ?? []} />
    </Card>
  );
}

function Diagnostico({ d, divergencias, usarGabarito }: { d: DiagnosticoAuditoria; divergencias: { tipo: string; valor: string }[]; usarGabarito?(t: string): void }) {
  const [aba, setAba] = useState<"diagnostico" | "gabarito">("diagnostico");
  return (
    <div className="space-y-3">
      <Segmented label="Resultado" value={aba} onChange={setAba} options={[{ value: "diagnostico", label: "Diagnóstico" }, { value: "gabarito", label: "Minuta gabarito" }]} />
      {aba === "gabarito" ? (
        <>
          {usarGabarito && <Button variant="ghost" size="sm" onClick={() => usarGabarito(d.minutaGabarito)}>Substituir a minuta pelo gabarito</Button>}
          <div className="claude-output space-y-2"><ClaudeTag>Gabarito redigido pelo Claude</ClaudeTag><MarkdownLite text={d.minutaGabarito} /></div>
        </>
      ) : (
        <div className="space-y-3 text-sm">
          <Secao titulo="Citra petita — risco de Embargos de Declaração" itens={d.adstricao.citraPetita} />
          <Secao titulo="Ultra petita" itens={d.adstricao.ultraPetita} />
          <Secao titulo="Extra petita" itens={d.adstricao.extraPetita} />
          <Secao titulo="Possíveis alucinações" itens={[...divergencias.map((x) => `${x.tipo}: ${x.valor} (não encontrado nos autos)`), ...d.alucinacoes.map((a) => `"${a.trecho}" — ${a.motivo}${a.fonteCorreta ? ` → correto: ${a.fonteCorreta}` : ""}`)]} />
          <Secao titulo="Precedentes vinculantes" itens={d.precedentesVinculantes.map((p) => `${p.precedente}: ${p.situacao.replace(/_/g, " ")}`)} neutro />
          <Secao titulo="Consectários (Lei nº 14.905/2024)" itens={[d.consectarios].filter(Boolean)} neutro />
          <Secao titulo="Recomendações" itens={d.recomendacoes} neutro />
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, itens, neutro }: { titulo: string; itens: string[]; neutro?: boolean }) {
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-stone-800 dark:text-stone-100">{titulo} <Badge tone={itens.length ? (neutro ? "slate" : "red") : "green"}>{itens.length}</Badge></h3>
      <ul className="list-disc space-y-1 pl-5 text-stone-700 dark:text-stone-300">{itens.map((i, k) => <li key={k}>{i}</li>)}</ul>
    </div>
  );
}
