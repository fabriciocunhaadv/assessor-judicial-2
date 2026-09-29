import { BookMarked, Calculator, Landmark } from "lucide-react";
import { useState } from "react";
import { calcularConsectarios, type ResultadoConsectarios } from "@shared/consectarios";
import { Badge, Button, Card, ErrorBox, Field, inputCls, Tabs } from "../components/ui";
import { REGIMES } from "../lib/regimes";

/** Legislação & Juros: catálogo de regimes por microssistema e calculadora da Lei nº 14.905/2024. */
export default function Consectarios() {
  const [aba, setAba] = useState<"regimes" | "calculadora">("regimes");
  const [regimeId, setRegimeId] = useState(REGIMES[0].id);
  const reg = REGIMES.find((r) => r.id === regimeId) ?? REGIMES[0];
  const [f, setF] = useState({ principal: "10000", inicioCorrecao: "2025-01", inicioJuros: "2025-02", fim: "2025-03", series: "2025-01;0,16;1,01\n2025-02;1,31;0,99\n2025-03;0,56;0,96" });
  const [r, setR] = useState<ResultadoConsectarios | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

  function calcular() {
    setErro(null);
    try {
      const ipca: { competencia: string; percentual: number }[] = [], selic: typeof ipca = [];
      for (const l of f.series.split("\n").map((x) => x.trim()).filter(Boolean)) {
        const [c, i, s] = l.split(/[;\t]/).map((x) => x.trim());
        if (!/^\d{4}-\d{2}$/.test(c ?? "") || i === undefined || s === undefined) throw new Error(`Linha inválida: "${l}". Use AAAA-MM;IPCA;Selic.`);
        ipca.push({ competencia: c, percentual: Number(i.replace(",", ".")) });
        selic.push({ competencia: c, percentual: Number(s.replace(",", ".")) });
      }
      setR(calcularConsectarios({ principal: Number(f.principal.replace(",", ".")), inicioCorrecao: f.inicioCorrecao, inicioJuros: f.inicioJuros, fim: f.fim, ipca, selic }));
    } catch (e) { setR(null); setErro((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Legislação & Juros</h1>
        <p className="text-sm text-slate-500">Regimes de correção monetária e juros por microssistema, com a calculadora da Lei nº 14.905/2024.</p>
      </div>
      <Tabs value={aba} onChange={setAba} tabs={[{ value: "regimes", label: <><Landmark className="h-4 w-4" /> Catálogo de regimes</>, count: REGIMES.length }, { value: "calculadora", label: <><Calculator className="h-4 w-4" /> Calculadora</> }]} />

      {aba === "regimes" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <Card title="Microssistemas e regimes" bodyClass="space-y-2 p-3">
            {REGIMES.map((r) => (
              <button key={r.id} type="button" onClick={() => setRegimeId(r.id)} aria-pressed={r.id === regimeId}
                className={`w-full rounded-lg border p-3 text-left ${r.id === regimeId ? "border-emerald-400 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"}`}>
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{r.titulo}</span>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{r.area}</span>
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{r.resumo}</span>
              </button>
            ))}
          </Card>
          <Card title={reg.titulo} icon={<BookMarked className="h-4 w-4 text-emerald-600" />} bodyClass="space-y-4 p-4" actions={<Badge tone="sky">{reg.area}</Badge>}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Correção monetária</p><p className="mt-1 text-sm">{reg.correcao}</p></div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Juros de mora</p><p className="mt-1 text-sm">{reg.juros}</p></div>
            </div>
            <div><h3 className="mb-1 text-sm font-semibold">Termos iniciais</h3><ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">{reg.termos.map((t) => <li key={t}>{t}</li>)}</ul></div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Diplomas e artigos fundamentais</h3>
              {reg.diplomas.map((d) => (
                <div key={d.nome} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">{d.nome}{d.artigos && <span className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] text-violet-700 dark:bg-violet-950 dark:text-violet-200">{d.artigos}</span>}</p>
                  <p className="text-xs text-slate-500">{d.nota}</p>
                </div>
              ))}
            </div>
            {reg.observacoes.map((o) => <p key={o} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{o}</p>)}
            <p className="text-xs text-slate-500">Referência de apoio. Confira sempre a legislação e a jurisprudência vigentes na data da decisão.</p>
          </Card>
        </div>
      )}

      {aba === "calculadora" && (
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card title="Parâmetros" icon={<Calculator className="h-4 w-4 text-emerald-600" />} bodyClass="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Principal (R$)"><input className={inputCls} value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} inputMode="decimal" /></Field>
            <Field label="Competência final"><input className={inputCls} value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} placeholder="AAAA-MM" /></Field>
            <Field label="Início da correção"><input className={inputCls} value={f.inicioCorrecao} onChange={(e) => setF({ ...f, inicioCorrecao: e.target.value })} placeholder="AAAA-MM" /></Field>
            <Field label="Início dos juros"><input className={inputCls} value={f.inicioJuros} onChange={(e) => setF({ ...f, inicioJuros: e.target.value })} placeholder="AAAA-MM" /></Field>
          </div>
          <Field label="Índices mensais" hint="AAAA-MM;IPCA%;Selic%"><textarea rows={8} className={`${inputCls} font-mono text-xs`} value={f.series} onChange={(e) => setF({ ...f, series: e.target.value })} /></Field>
          <p className="text-xs text-amber-700 dark:text-amber-300">Os índices de exemplo são ilustrativos. Use os oficiais do IBGE e do Banco Central; nenhum valor é estimado.</p>
          <Button onClick={calcular}>Calcular</Button>
          <ErrorBox erro={erro} />
        </Card>
        <Card title="Memória de cálculo" bodyClass="overflow-x-auto p-0">
          {r ? (
            <>
              <table className="w-full text-right text-sm tabular-nums">
                <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left">Competência</th><th className="px-2">IPCA</th><th className="px-2">Selic</th><th className="px-2">Taxa legal</th><th className="px-4">Fator</th></tr></thead>
                <tbody>{r.memoria.map((m) => <tr key={m.competencia} className="border-t border-slate-100 dark:border-slate-800"><td className="px-4 py-1.5 text-left">{m.competencia}</td><td className="px-2">{pct(m.ipca)}</td><td className="px-2">{pct(m.selic)}</td><td className="px-2">{pct(m.taxaLegal)}</td><td className="px-4">{m.fatorCorrecao.toFixed(6)}</td></tr>)}</tbody>
              </table>
              <dl className="grid gap-2 border-t border-slate-200 p-4 text-sm sm:grid-cols-3 dark:border-slate-800">
                <div><dt className="text-slate-500">Valor corrigido</dt><dd className="text-lg font-semibold tabular-nums">{brl(r.valorCorrigido)}</dd></div>
                <div><dt className="text-slate-500">Juros</dt><dd className="text-lg font-semibold tabular-nums">{brl(r.juros)}</dd></div>
                <div><dt className="text-slate-500">Total</dt><dd className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{brl(r.total)}</dd></div>
              </dl>
              <p className="border-t border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">{r.fundamentacao}</p>
            </>
          ) : <p className="p-4 text-sm text-slate-500">Informe os parâmetros e clique em Calcular.</p>}
        </Card>
      </div>
      )}
    </div>
  );
}
