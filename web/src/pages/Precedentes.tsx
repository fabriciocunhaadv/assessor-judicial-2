import { Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Precedente } from "@shared/schemas";
import { Badge, Button, Card, ErrorBox, textareaCls } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Item = Precedente & { id: string };
const TRIBUNAIS = ["TODOS", "STF", "STJ", "TNU", "TJGO", "GABINETE"] as const;

export default function Precedentes() {
  const { pode } = useAuth();
  const [itens, setItens] = useState<Item[]>([]);
  const [filtro, setFiltro] = useState<(typeof TRIBUNAIS)[number]>("TODOS");
  const [q, setQ] = useState("");
  const [importando, setImportando] = useState(false);
  const [relatorio, setRelatorio] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = () => api.get<Item[]>("/precedentes").then(setItens).catch((e) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);

  const visiveis = useMemo(() => {
    const t = q.toLowerCase();
    return itens.filter((i) => (filtro === "TODOS" || i.tribunal === filtro) && (!t || `${i.identificador} ${i.enunciado} ${i.palavrasChave.join(" ")}`.toLowerCase().includes(t)));
  }, [itens, filtro, q]);

  async function importar(file?: File) {
    if (!file) return;
    setErro(null); setRelatorio(null); setImportando(true);
    try {
      const r = await api.upload<{ paginas: number; blocos: number; blocosComFalha: number[]; indexados: number }>("/precedentes/importar", file);
      setRelatorio(`${file.name}: ${r.paginas} páginas em ${r.blocos} blocos → ${r.indexados} julgados indexados.` + (r.blocosComFalha.length ? ` Blocos com falha (reenvie): ${r.blocosComFalha.join(", ")}.` : ""));
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <Card title={`Repositório vinculante (${itens.length})`} actions={pode("precedentes:importar") && (
      <label className="cursor-pointer"><span className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">{importando ? "Importando…" : <><Upload className="h-4 w-4" /> Importar PDF de informativo</>}</span><input type="file" accept="application/pdf" className="hidden" disabled={importando} onChange={(e) => importar(e.target.files?.[0])} /></label>
    )}>
      <div className="mb-3 flex flex-wrap gap-2">
        {TRIBUNAIS.map((t) => <Button key={t} variant={filtro === t ? "primary" : "ghost"} onClick={() => setFiltro(t)}>{t}</Button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por tema, número ou palavra-chave" className={`${textareaCls} max-w-md py-2`} />
      </div>
      {relatorio && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{relatorio}</p>}
      <ErrorBox erro={erro} />
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {visiveis.map((p) => (
          <li key={p.id} className="py-3 text-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2"><Badge>{p.tribunal}</Badge><strong>{p.identificador}</strong><span className="text-xs text-slate-500">{p.tipo.replace(/_/g, " ")}</span></div>
            <p className="text-slate-700 dark:text-slate-300">{p.enunciado}</p>
            {p.fonte && <p className="mt-1 text-xs text-slate-500">Fonte: {p.fonte}</p>}
          </li>
        ))}
      </ul>
      {!visiveis.length && <p className="text-sm text-slate-500">Nenhum precedente. Importe informativos e cadernos em PDF (STF, STJ, TNU, TJGO).</p>}
    </Card>
  );
}
