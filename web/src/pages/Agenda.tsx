import { CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Timer, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { calcularPrazo, type ResultadoPrazo } from "@shared/prazos";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Notice, Segmented, Tabs } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useGabinete } from "../lib/gabinete";

type Tipo = "prazo" | "audiencia" | "diligencia" | "outro";
interface Evento { id: string; titulo: string; tipo: Tipo; data: string; hora: string; processo: string; responsavel: string; unidadeId: string; observacao: string; concluido: boolean }

const TIPO: Record<Tipo, { rotulo: string; tom: "red" | "violet" | "sky" | "slate"; ponto: string }> = {
  prazo: { rotulo: "Prazo", tom: "red", ponto: "bg-rose-500" },
  audiencia: { rotulo: "Audiência", tom: "violet", ponto: "bg-violet-500" },
  diligencia: { rotulo: "Diligência", tom: "sky", ponto: "bg-sky-500" },
  outro: { rotulo: "Outro", tom: "slate", ponto: "bg-stone-400" },
};
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hoje = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso local
const fmt = (d: string) => d.split("-").reverse().join("/");
const pad = (n: number) => String(n).padStart(2, "0");
const vazio = (data: string): Omit<Evento, "id"> => ({ titulo: "", tipo: "prazo", data, hora: "", processo: "", responsavel: "", unidadeId: "", observacao: "", concluido: false });

export default function Agenda() {
  const { pode } = useAuth();
  const { unidadeId } = useGabinete();
  const [aba, setAba] = useState<"calendario" | "prazo" | "google">("calendario");
  const [mes, setMes] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [dia, setDia] = useState(hoje());
  const [form, setForm] = useState<(Omit<Evento, "id"> & { id?: string }) | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [google, setGoogle] = useState({ url: "", salvo: "" });

  const de = `${mes.y}-${pad(mes.m + 1)}-01`;
  const ate = `${mes.y}-${pad(mes.m + 1)}-${pad(new Date(mes.y, mes.m + 1, 0).getDate())}`;
  const carregar = () => api.get<Evento[]>(`/agenda?de=${de}&ate=${ate}`).then(setEventos).catch((e) => setErro(e.message));
  useEffect(() => { void carregar(); }, [de, ate]);
  useEffect(() => { api.get<{ texto: string }>("/gabinete/documentos/agenda_config").then((c) => setGoogle({ url: c.texto, salvo: c.texto })).catch(() => {}); }, []);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    eventos.forEach((e) => m.set(e.data, [...(m.get(e.data) ?? []), e]));
    return m;
  }, [eventos]);
  const celulas = useMemo(() => {
    const primeiro = new Date(mes.y, mes.m, 1).getDay();
    const total = new Date(mes.y, mes.m + 1, 0).getDate();
    return [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => `${mes.y}-${pad(mes.m + 1)}-${pad(i + 1)}`)];
  }, [mes]);
  const pendentesVencidos = eventos.filter((e) => !e.concluido && e.data < hoje()).length;

  async function salvar() {
    if (!form) return;
    setErro(null);
    try {
      const { id, ...corpo } = form;
      await api.post(`/agenda${id ? `/${id}` : ""}`, corpo, "PUT");
      setForm(null); await carregar();
    } catch (e) { setErro((e as Error).message); }
  }
  async function alternar(e: Evento) {
    try { const { id, ...c } = e; await api.post(`/agenda/${id}`, { ...c, concluido: !e.concluido }, "PUT"); await carregar(); } catch (x) { setErro((x as Error).message); }
  }
  async function excluir(id: string) {
    try { await api.del(`/agenda/${id}`); setConfirmar(null); await carregar(); } catch (x) { setErro((x as Error).message); }
  }
  const mudarMes = (d: number) => setMes(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });

  const doDia = porDia.get(dia) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-stone-900 dark:text-white">Agenda do gabinete</h1>
          <p className="text-sm text-stone-500">Prazos, audiências e diligências da equipe, com contagem de prazos em dias úteis pelo CPC.</p>
        </div>
        <Button onClick={() => { setAba("calendario"); setForm({ ...vazio(dia), unidadeId }); }}><Plus className="h-4 w-4" /> Novo compromisso</Button>
      </div>
      <Tabs value={aba} onChange={setAba} tabs={[
        { value: "calendario", label: <><CalendarDays className="h-4 w-4" /> Calendário</>, count: eventos.filter((e) => !e.concluido).length },
        { value: "prazo", label: <><Timer className="h-4 w-4" /> Calcular prazo</> },
        { value: "google", label: "Google Agenda" },
      ]} />
      <ErrorBox erro={erro} />

      {aba === "calendario" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <Card title={`${MESES[mes.m][0].toUpperCase()}${MESES[mes.m].slice(1)} de ${mes.y}`} actions={<>
            {pendentesVencidos > 0 && <Badge tone="red">{pendentesVencidos} vencido(s) em aberto</Badge>}
            <Button size="sm" variant="ghost" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); setMes({ y: d.getFullYear(), m: d.getMonth() }); setDia(hoje()); }}>Hoje</Button>
            <Button size="sm" variant="ghost" onClick={() => mudarMes(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
          </>} bodyClass="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-400">{["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((d, i) => d === null ? <div key={`v${i}`} /> : (
                <button key={d} type="button" onClick={() => setDia(d)} aria-pressed={dia === d} aria-label={`${fmt(d)}: ${(porDia.get(d) ?? []).length} compromisso(s)`}
                  className={`flex min-h-[4.5rem] min-w-0 flex-col items-start gap-1 overflow-hidden rounded-lg border p-1.5 text-left text-xs transition ${dia === d ? "border-clay-500 bg-clay-50 dark:bg-clay-950/40" : "border-stone-100 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/50"}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full font-semibold tabular-nums ${d === hoje() ? "bg-clay-600 text-white" : "text-stone-700 dark:text-stone-200"}`}>{Number(d.slice(8))}</span>
                  <span className="flex flex-wrap gap-0.5">{(porDia.get(d) ?? []).slice(0, 6).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${TIPO[e.tipo].ponto} ${e.concluido ? "opacity-30" : ""}`} />)}</span>
                  {(porDia.get(d) ?? []).length > 0 && <span className="hidden w-full truncate text-[11px] text-stone-500 md:block">{(porDia.get(d) ?? [])[0].titulo}</span>}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">{(Object.keys(TIPO) as Tipo[]).map((t) => <span key={t} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${TIPO[t].ponto}`} />{TIPO[t].rotulo}</span>)}</div>
          </Card>

          <div className="space-y-4">
            {form ? (
              <Card title={form.id ? "Editar compromisso" : "Novo compromisso"} bodyClass="space-y-3 p-4">
                <Field label="Título"><input className={inputCls} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Prazo para réplica" /></Field>
                <Segmented label="Tipo" value={form.tipo} onChange={(t) => setForm({ ...form, tipo: t })} options={(Object.keys(TIPO) as Tipo[]).map((t) => ({ value: t, label: TIPO[t].rotulo }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data"><input type="date" className={inputCls} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
                  <Field label="Hora" hint="opcional"><input type="time" className={inputCls} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></Field>
                </div>
                <Field label="Processo" hint="opcional"><input className={`${inputCls} font-mono`} value={form.processo} onChange={(e) => setForm({ ...form, processo: e.target.value })} placeholder="0000000-00.0000.0.00.0000" /></Field>
                <Field label="Responsável" hint="opcional"><input className={inputCls} value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></Field>
                <Field label="Observação" hint="opcional"><textarea rows={2} className={inputCls} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></Field>
                <div className="flex gap-2"><Button disabled={form.titulo.trim().length < 3 || !form.data} onClick={() => void salvar()}>Salvar</Button><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button></div>
              </Card>
            ) : null}
            <Card title={`Compromissos de ${fmt(dia)}`} icon={<CalendarClock className="h-4 w-4 text-clay-600" />} actions={<Button size="sm" variant="ghost" onClick={() => setForm({ ...vazio(dia), unidadeId })}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>} bodyClass="divide-y divide-stone-100 dark:divide-stone-800">
              {doDia.length ? doDia.map((e) => (
                <div key={e.id} className="space-y-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-medium ${e.concluido ? "text-stone-400 line-through" : "text-stone-900 dark:text-stone-100"}`}>{e.hora && <span className="mr-1.5 font-mono text-xs text-stone-500">{e.hora}</span>}{e.titulo}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500"><Badge tone={TIPO[e.tipo].tom}>{TIPO[e.tipo].rotulo}</Badge>{e.processo && <span className="font-mono">{e.processo}</span>}{e.responsavel && <span>· {e.responsavel}</span>}{!e.concluido && e.data < hoje() && <Badge tone="red">vencido</Badge>}</p>
                      {e.observacao && <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">{e.observacao}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant={e.concluido ? "ghost" : "subtle"} onClick={() => void alternar(e)} aria-label={e.concluido ? "Reabrir" : "Concluir"}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="subtle" onClick={() => setForm({ ...e })}>Editar</Button>
                      <Button size="sm" variant="subtle" onClick={() => setConfirmar(e.id)} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  {confirmar === e.id && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950 dark:text-rose-200">Excluir este compromisso? <Button size="sm" variant="danger" onClick={() => void excluir(e.id)}>Excluir</Button><Button size="sm" variant="ghost" onClick={() => setConfirmar(null)}>Cancelar</Button></div>}
                </div>
              )) : <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nenhum compromisso neste dia">Use Adicionar ou calcule um prazo e salve na agenda.</EmptyState>}
            </Card>
          </div>
        </div>
      )}

      {aba === "prazo" && <CalculadoraPrazo salvarNaAgenda={(e) => { setDia(e.data); setMes({ y: Number(e.data.slice(0, 4)), m: Number(e.data.slice(5, 7)) - 1 }); setForm({ ...vazio(e.data), ...e, unidadeId }); setAba("calendario"); }} />}

      {aba === "google" && (
        <div className="space-y-4">
          {google.salvo ? <Card bodyClass="p-0"><iframe title="Google Agenda do gabinete" src={google.salvo} className="h-[70vh] w-full rounded-xl border-0" /></Card>
            : <Notice>Nenhum Google Agenda vinculado. Se o gabinete já usa um calendário do Google, cole abaixo o endereço de incorporação (Google Agenda → Configurações do calendário → Integrar agenda → "URL pública" ou "Código para incorporar").</Notice>}
          {pode("gabinete:teses_editar") && (
            <Card title="Vincular Google Agenda" bodyClass="space-y-3 p-4">
              <input className={`${inputCls} font-mono text-xs`} value={google.url} onChange={(e) => setGoogle({ ...google, url: e.target.value.trim() })} placeholder="https://calendar.google.com/calendar/embed?src=…" />
              <div className="flex gap-2">
                <Button disabled={google.url === google.salvo} onClick={() => api.post<{ texto: string }>("/gabinete/documentos/agenda_config", { texto: google.url }, "PUT").then((c) => setGoogle({ url: c.texto, salvo: c.texto }), (e) => setErro(e.message))}>Salvar</Button>
                {google.salvo && <Button variant="ghost" onClick={() => api.post("/gabinete/documentos/agenda_config", { texto: "" }, "PUT").then(() => setGoogle({ url: "", salvo: "" }), (e) => setErro(e.message))}>Desvincular</Button>}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CalculadoraPrazo({ salvarNaAgenda }: { salvarNaAgenda(e: { titulo: string; data: string; processo: string; observacao: string }): void }) {
  const [f, setF] = useState({ intimacao: hoje(), dias: "15", uteis: true, extras: "", processo: "", ato: "Prazo para manifestação" });
  const [r, setR] = useState<ResultadoPrazo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  function calcular() {
    setErro(null);
    try {
      const extras = f.extras.split(/[\s,;]+/).filter(Boolean).map((d) => (/^\d{2}\/\d{2}\/\d{4}$/.test(d) ? d.split("/").reverse().join("-") : d));
      setR(calcularPrazo(f.intimacao, Number(f.dias), extras, f.uteis));
    } catch (e) { setR(null); setErro((e as Error).message); }
  }
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card title="Parâmetros" icon={<Timer className="h-4 w-4 text-clay-600" />} bodyClass="space-y-3 p-4">
        <Field label="Ato / descrição"><input className={inputCls} value={f.ato} onChange={(e) => setF({ ...f, ato: e.target.value })} /></Field>
        <Field label="Processo" hint="opcional"><input className={`${inputCls} font-mono`} value={f.processo} onChange={(e) => setF({ ...f, processo: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Intimação / publicação"><input type="date" className={inputCls} value={f.intimacao} onChange={(e) => setF({ ...f, intimacao: e.target.value })} /></Field>
          <Field label="Prazo (dias)"><input type="number" min={1} className={inputCls} value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })} /></Field>
        </div>
        <Segmented label="Contagem" value={f.uteis ? "uteis" : "corridos"} onChange={(v) => setF({ ...f, uteis: v === "uteis" })} options={[{ value: "uteis", label: "Dias úteis (CPC, art. 219)" }, { value: "corridos", label: "Dias corridos" }]} />
        <Field label="Datas sem expediente no tribunal" hint="feriados locais, suspensões"><textarea rows={2} className={`${inputCls} font-mono text-xs`} value={f.extras} onChange={(e) => setF({ ...f, extras: e.target.value })} placeholder="Ex.: 24/10/2025, 20/02/2026" /></Field>
        <p className="text-xs text-stone-500">Já considerados: sábados, domingos, feriados nacionais e o recesso de 20/12 a 20/01 (art. 220). Carnaval, Semana Santa e feriados locais variam por tribunal: informe-os acima.</p>
        <Button onClick={calcular}>Calcular vencimento</Button>
        <ErrorBox erro={erro} />
      </Card>
      <Card title="Resultado">
        {r ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-stone-50 p-3 dark:bg-stone-950"><p className="text-xs text-stone-500">Início da contagem</p><p className="text-lg font-semibold tabular-nums">{fmt(r.inicioContagem)}</p></div>
              <div className="rounded-lg bg-clay-50 p-3 dark:bg-clay-950"><p className="text-xs text-clay-700 dark:text-clay-300">Vencimento</p><p className="text-lg font-semibold tabular-nums text-clay-800 dark:text-clay-200">{fmt(r.vencimento)}</p></div>
              <div className="rounded-lg bg-stone-50 p-3 dark:bg-stone-950"><p className="text-xs text-stone-500">Dias corridos</p><p className="text-lg font-semibold tabular-nums">{r.diasCorridos}</p></div>
            </div>
            {r.ignorados.length > 0 && (
              <div><h3 className="mb-1 text-sm font-semibold">Dias não computados ({r.ignorados.length})</h3>
                <ul className="grid max-h-56 gap-1 overflow-auto text-xs text-stone-600 sm:grid-cols-2 dark:text-stone-300">{r.ignorados.map((i) => <li key={i.data}><span className="font-mono">{fmt(i.data)}</span> — {i.motivo}</li>)}</ul>
              </div>
            )}
            <Button variant="dark" onClick={() => salvarNaAgenda({ titulo: f.ato, data: r.vencimento, processo: f.processo, observacao: `Intimação em ${fmt(f.intimacao)}; ${f.dias} dias ${f.uteis ? "úteis" : "corridos"}.` })}><CalendarClock className="h-4 w-4" /> Salvar vencimento na agenda</Button>
          </div>
        ) : <p className="text-sm text-stone-500">Informe a data da intimação e o prazo. O dia do começo é excluído e o do vencimento incluído (art. 224 do CPC).</p>}
      </Card>
    </div>
  );
}
