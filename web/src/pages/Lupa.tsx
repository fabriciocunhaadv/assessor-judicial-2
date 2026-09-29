import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { DiagnosticoAuditoria } from "@shared/schemas";
import { MarkdownLite } from "../components/MarkdownLite";
import { Badge, Button, Card, ErrorBox, textareaCls } from "../components/ui";
import { api } from "../lib/api";
import { useCaso } from "../lib/caso";

interface Resposta { diagnostico: DiagnosticoAuditoria; divergenciasAutomaticas: { tipo: string; valor: string }[]; modelo: string }

/** Bancada de Tripla Conferência: autos | minuta do assessor | diagnóstico e gabarito. */
export default function Lupa() {
  const { caso, atualizar } = useCaso();
  const [busca, setBusca] = useState("");
  const [r, setR] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"diagnostico" | "gabarito">("diagnostico");

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
    setErro(null);
    setCarregando(true);
    try {
      setR(await api.post<Resposta>("/lupa/auditar", { minuta: caso.minuta, autos: caso.resumoExecutivo || caso.autos, autosIntegrais: caso.autos }));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const d = r?.diagnostico;
  const pdfSrc = (pag?: string) => (caso.pdfUrl ? `${caso.pdfUrl}${pag ? `#page=${pag}` : ""}` : undefined);
  const [pagina, setPagina] = useState<string | undefined>();

  return (
    <div className="grid h-[calc(100vh-7rem)] gap-3 xl:grid-cols-3">
      <Card title="1 · Autos" className="flex min-h-0 flex-col" actions={<div className="relative"><Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nos autos" className="rounded-md border border-slate-300 bg-transparent py-1 pl-7 pr-2 text-sm dark:border-slate-700" /></div>}>
        {ocorrencias.length > 0 && (
          <ul className="mb-2 max-h-40 space-y-1 overflow-auto text-xs">
            {ocorrencias.map((o, i) => (
              <li key={i}><button onClick={() => setPagina(o.pag)} className="text-left hover:underline"><Badge>Pág. {o.pag}</Badge> …{o.trecho}…</button></li>
            ))}
          </ul>
        )}
        {caso.pdfUrl ? <iframe key={pagina} title="Autos" src={pdfSrc(pagina)} className="h-full min-h-[60vh] w-full rounded border-0" /> : <p className="text-sm text-slate-500">Carregue os autos na Esteira de Minutas.</p>}
      </Card>

      <Card title="2 · Minuta do assessor" className="flex min-h-0 flex-col" actions={<Button onClick={auditar} loading={carregando} disabled={!caso.minuta || !caso.autos}>Auditar</Button>}>
        <textarea value={caso.minuta} onChange={(e) => atualizar({ minuta: e.target.value })} className={`${textareaCls} h-full min-h-[60vh] font-serif`} />
        <ErrorBox erro={erro} />
      </Card>

      <Card title="3 · Diagnóstico e gabarito" className="flex min-h-0 flex-col overflow-auto" actions={d && <Badge tone={d.nota >= 8 ? "green" : d.nota >= 6 ? "amber" : "red"}>Nota {d.nota.toFixed(1)}</Badge>}>
        {!d ? (
          <p className="text-sm text-slate-500">A Matriz de Conformidade verifica adstrição (extra/ultra/citra petita), alucinações de dados, precedentes vinculantes e consectários.</p>
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              <Button variant={aba === "diagnostico" ? "primary" : "ghost"} onClick={() => setAba("diagnostico")}>Diagnóstico</Button>
              <Button variant={aba === "gabarito" ? "primary" : "ghost"} onClick={() => setAba("gabarito")}>Minuta gabarito</Button>
            </div>
            {aba === "gabarito" ? (
              <>
                <Button variant="ghost" className="mb-3" onClick={() => atualizar({ minuta: d.minutaGabarito })}>Substituir minuta pelo gabarito</Button>
                <MarkdownLite text={d.minutaGabarito} />
              </>
            ) : (
              <div className="space-y-3 text-sm">
                <Secao titulo="Citra petita — risco de Embargos de Declaração" itens={d.adstricao.citraPetita} />
                <Secao titulo="Ultra petita" itens={d.adstricao.ultraPetita} />
                <Secao titulo="Extra petita" itens={d.adstricao.extraPetita} />
                <Secao titulo="Possíveis alucinações" itens={[...r!.divergenciasAutomaticas.map((x) => `${x.tipo}: ${x.valor} (não encontrado nos autos)`), ...d.alucinacoes.map((a) => `"${a.trecho}" — ${a.motivo}${a.fonteCorreta ? ` → correto: ${a.fonteCorreta}` : ""}`)]} />
                <Secao titulo="Precedentes vinculantes" itens={d.precedentesVinculantes.map((p) => `${p.precedente}: ${p.situacao.replace(/_/g, " ")}`)} ok={(s) => s.endsWith("respeitado")} />
                <Secao titulo="Consectários (Lei 14.905/2024)" itens={[d.consectarios]} ok={() => true} />
                <Secao titulo="Recomendações" itens={d.recomendacoes} ok={() => true} />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function Secao({ titulo, itens, ok }: { titulo: string; itens: string[]; ok?: (s: string) => boolean }) {
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">{titulo} <Badge tone={itens.length ? (ok ? "slate" : "red") : "green"}>{itens.length}</Badge></h3>
      <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">{itens.map((i, k) => <li key={k}>{i}</li>)}</ul>
    </div>
  );
}
