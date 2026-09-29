import { Scale, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { MinutaOutput } from "../../../server/pipelines/minutePipeline";
import { MarkdownLite } from "../components/MarkdownLite";
import { PdfUpload } from "../components/PdfUpload";
import { Badge, Button, Card, ErrorBox, textareaCls } from "../components/ui";
import { api } from "../lib/api";
import { useCaso } from "../lib/caso";

interface Paradigma { id: string; titulo: string; tipoAto: string }

export default function Esteira() {
  const { caso, atualizar } = useCaso();
  const [paradigmas, setParadigmas] = useState<Paradigma[]>([]);
  const [paradigmaId, setParadigmaId] = useState<string>(() => sessionStorage.getItem("paradigmaInjetado") ?? "");
  const [instrucao, setInstrucao] = useState("");
  const [usarTeses, setUsarTeses] = useState(true);
  const [resultado, setResultado] = useState<MinutaOutput | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get<Paradigma[]>("/gabinete/paradigmas").then(setParadigmas).catch(() => setParadigmas([]));
  }, []);

  async function gerar() {
    setErro(null);
    setCarregando(true);
    try {
      const r = await api.post<MinutaOutput>("/minutas", { autos: caso.autos, paradigmaId: paradigmaId || null, instrucao, usarTeses });
      setResultado(r);
      atualizar({ minuta: r.markdown, resumoExecutivo: r.resumoExecutivo, numeroProcesso: r.dossie.numeroProcesso });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const v = resultado?.verificacoes;
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        <Card title="1. Autos processuais">
          <PdfUpload />
        </Card>
        <Card title="2. Parâmetros do gabinete">
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-slate-600 dark:text-slate-300">Minuta Paradigma (espelho estrutural)</span>
              <select value={paradigmaId} onChange={(e) => setParadigmaId(e.target.value)} className={textareaCls}>
                <option value="">— Sem paradigma —</option>
                {paradigmas.map((p) => <option key={p.id} value={p.id}>{p.titulo} ({p.tipoAto})</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={usarTeses} onChange={(e) => setUsarTeses(e.target.checked)} /> Aplicar Caderno de Teses do Gabinete
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600 dark:text-slate-300">Orientação para este caso (opcional)</span>
              <textarea rows={4} value={instrucao} onChange={(e) => setInstrucao(e.target.value)} className={textareaCls} placeholder="Ex.: analisar com atenção a impugnação da assinatura do contrato (Tema 1.061/STJ)." />
            </label>
            <Button onClick={gerar} loading={carregando} disabled={!caso.autos} className="w-full">
              <Sparkles className="h-4 w-4" /> Gerar minuta (2 etapas)
            </Button>
            {carregando && <p className="text-xs text-slate-500">Etapa 1: Assessor Fático extraindo a cronologia → Etapa 2: Juiz Revisor redigindo. Autos volumosos podem levar alguns minutos.</p>}
            <ErrorBox erro={erro} />
          </div>
        </Card>
        {v && (
          <Card title="Verificações automáticas">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">Parágrafos densos na fundamentação <Badge tone={v.paragrafosDensos >= 14 ? "green" : "amber"}>{v.paragrafosDensos}</Badge></li>
              <li className="flex items-center justify-between">Pedidos não apreciados <Badge tone={v.pedidosNaoApreciados.length ? "red" : "green"}>{v.pedidosNaoApreciados.length}</Badge></li>
              <li className="flex items-center justify-between">Dados sem lastro nos autos <Badge tone={v.dadosNaoEncontradosNosAutos.length ? "red" : "green"}>{v.dadosNaoEncontradosNosAutos.length}</Badge></li>
            </ul>
            {[...v.pedidosNaoApreciados, ...v.dadosNaoEncontradosNosAutos.map((d) => `${d.tipo}: ${d.valor}`)].map((x) => (
              <p key={x} className="mt-2 text-xs text-rose-700 dark:text-rose-300">• {x}</p>
            ))}
            <p className="mt-3 text-xs text-slate-500">Modelos: {resultado!.modelos.etapa1} → {resultado!.modelos.etapa2}</p>
          </Card>
        )}
      </div>

      <Card title={<span className="flex items-center gap-2"><Scale className="h-4 w-4" /> Minuta {caso.numeroProcesso && `— ${caso.numeroProcesso}`}</span>}>
        {caso.minuta ? (
          <MarkdownLite text={caso.minuta} />
        ) : (
          <p className="text-sm text-slate-500">Carregue os autos e gere a minuta. Depois, refine no Chat ou envie para a Lupa do Magistrado.</p>
        )}
        {resultado && resultado.dossie.alertas.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <strong>Alertas do Assessor Fático:</strong>
            <ul className="list-disc pl-5">{resultado.dossie.alertas.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
      </Card>
    </div>
  );
}
