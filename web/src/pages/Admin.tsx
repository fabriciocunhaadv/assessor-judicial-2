import { useEffect, useState } from "react";
import { Card, ErrorBox } from "../components/ui";
import { api } from "../lib/api";

interface Agregado { chamadas: number; entrada: number; saida: number; usd: number; brl: number }
interface Consumo {
  periodoDias: number;
  cotacaoUsdBrl: number;
  total: { chamadas: number; usd: number; brl: number };
  porFuncionalidade: Record<string, Agregado>;
  porModelo: Record<string, Agregado>;
  porGabinete: Record<string, Agregado>;
  modelosSemPreco: string[];
}

const ROTULO: Record<string, string> = { minuta: "Minutas", lupa: "Lupa do Magistrado", audiencia: "Mesa de Audiência", chat: "Chat", precedentes: "Importação de precedentes", sinopse: "Resumo Executivo" };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function Admin() {
  const [dias, setDias] = useState(30);
  const [c, setC] = useState<Consumo | null>(null);
  const [cascata, setCascata] = useState<{ provider: string; models: string[]; keys: number }[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get<Consumo>(`/admin/consumo?dias=${dias}`).then(setC).catch((e) => setErro(e.message));
    api.get<{ cascata: typeof cascata }>("/admin/motor").then((r) => setCascata(r.cascata)).catch(() => {});
  }, [dias]);

  const Tabela = ({ titulo, dados, rotulo = (k: string) => k }: { titulo: string; dados: Record<string, Agregado>; rotulo?: (k: string) => string }) => (
    <Card title={titulo}>
      <table className="w-full text-right text-sm tabular-nums">
        <thead className="text-slate-500"><tr><th className="text-left">Item</th><th>Chamadas</th><th>Tokens entrada</th><th>Tokens saída</th><th>USD</th><th>R$</th></tr></thead>
        <tbody>{Object.entries(dados).sort((a, b) => b[1].usd - a[1].usd).map(([k, v]) => (
          <tr key={k} className="border-t border-slate-100 dark:border-slate-800"><td className="text-left">{rotulo(k)}</td><td>{v.chamadas}</td><td>{v.entrada.toLocaleString("pt-BR")}</td><td>{v.saida.toLocaleString("pt-BR")}</td><td>{usd(v.usd)}</td><td>{brl(v.brl)}</td></tr>
        ))}</tbody>
      </table>
    </Card>
  );

  return (
    <div className="space-y-4">
      <ErrorBox erro={erro} />
      <div className="flex flex-wrap items-center gap-3">
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700">
          {[1, 7, 30, 90].map((d) => <option key={d} value={d}>Últimos {d} dia(s)</option>)}
        </select>
        {c && <span className="text-sm text-slate-600 dark:text-slate-300">{c.total.chamadas} chamadas · <strong>{usd(c.total.usd)}</strong> · <strong>{brl(c.total.brl)}</strong> (cotação {c.cotacaoUsdBrl.toFixed(2)})</span>}
      </div>
      {c && c.modelosSemPreco.length > 0 && <ErrorBox erro={`Modelos sem preço cadastrado (custo contabilizado como zero): ${c.modelosSemPreco.join(", ")}. Atualize shared/pricing.ts.`} />}
      <Card title="Cascata do motor de IA">
        {cascata.length === 0 && <p className="text-sm text-rose-700 dark:text-rose-300">Nenhum provedor de IA configurado. Preencha ANTHROPIC_API_KEYS e/ou GEMINI_API_KEYS no arquivo .env e reinicie o servidor.</p>}
        <ol className="list-decimal pl-5 text-sm">{cascata.map((p) => <li key={p.provider}><strong>{p.provider}</strong>: {p.models.join(" → ")} ({p.keys} chave(s) no pool)</li>)}</ol>
      </Card>
      {c && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Tabela titulo="Por funcionalidade" dados={c.porFuncionalidade} rotulo={(k) => ROTULO[k] ?? k} />
          <Tabela titulo="Por modelo" dados={c.porModelo} />
          <Tabela titulo="Por gabinete" dados={c.porGabinete} />
        </div>
      )}
    </div>
  );
}
