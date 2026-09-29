import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, ErrorBox } from "../components/ui";
import { api } from "../lib/api";
import { useCaso } from "../lib/caso";

interface Registro { id: string; numeroProcesso: string; tipoAto: string; criadoEm: number; resumoExecutivo: string; minuta: { markdown?: string } }

export default function Historico() {
  const [itens, setItens] = useState<Registro[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { atualizar } = useCaso();
  const navigate = useNavigate();
  useEffect(() => { api.get<Registro[]>("/minutas").then(setItens).catch((e) => setErro(e.message)); }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Histórico</h1>
        <p className="text-sm text-slate-500">Últimas 50 minutas do gabinete. Os autos não são guardados, só a minuta e o resumo executivo.</p>
      </div>
      <ErrorBox erro={erro} />
      <Card bodyClass="divide-y divide-slate-100 dark:divide-slate-800">
        {itens === null ? <p className="p-4 text-sm text-slate-500">Carregando…</p> : itens.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="Nenhuma minuta ainda">As minutas geradas pela equipe aparecem aqui.</EmptyState>
        ) : itens.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">{m.numeroProcesso}</p>
              <p className="text-xs text-slate-500">{m.tipoAto} · {new Date(m.criadoEm).toLocaleString("pt-BR")}</p>
            </div>
            <Button size="sm" variant="ghost" disabled={!m.minuta?.markdown} onClick={() => { atualizar({ nomeArquivo: `Histórico ${m.numeroProcesso} (sem os autos)`, pdfUrl: null, autos: "", paginas: 0, minuta: m.minuta.markdown ?? "", resumoExecutivo: m.resumoExecutivo, numeroProcesso: m.numeroProcesso, resultado: null }); navigate("/"); }}>Abrir minuta</Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
