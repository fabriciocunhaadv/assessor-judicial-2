import { ClipboardCopy, FileText, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorBox, inputCls, Notice, Segmented } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

/**
 * Guia do PROJUDI do gabinete: rotinas, códigos de movimentação e modelos de expediente.
 * Começa vazio — o conteúdo é do gabinete; nada é pré-carregado nem sobrescrito.
 */
export default function GuiaProjudi() {
  const { pode } = useAuth();
  const [texto, setTexto] = useState("");
  const [salvo, setSalvo] = useState("");
  const [meta, setMeta] = useState<number>(0);
  const [modo, setModo] = useState<"ler" | "editar">("ler");
  const [q, setQ] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const podeEditar = pode("gabinete:teses_editar");

  useEffect(() => {
    api.get<{ texto: string; atualizadoEm: number }>("/gabinete/documentos/guia_projudi").then((d) => { setTexto(d.texto); setSalvo(d.texto); setMeta(d.atualizadoEm); if (!d.texto && podeEditar) setModo("editar"); }).catch((e) => setErro(e.message));
  }, [podeEditar]);

  /** Seções: blocos separados por linha em branco; a busca mostra só as que contêm todos os termos. */
  const secoes = useMemo(() => salvo.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean), [salvo]);
  const termos = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const achadas = termos.length ? secoes.filter((s) => termos.every((t) => s.toLowerCase().includes(t))) : secoes;

  const realce = (s: string) => {
    if (!termos.length) return s;
    const re = new RegExp(`(${termos.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    return s.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-amber-200 px-0.5 dark:bg-amber-700/60">{p}</mark> : p));
  };

  async function salvar() {
    setErro(null); setOk(null); setSalvando(true);
    try {
      const d = await api.post<{ texto: string; atualizadoEm: number }>("/gabinete/documentos/guia_projudi", { texto }, "PUT");
      setSalvo(d.texto); setMeta(d.atualizadoEm); setOk("Guia salvo. A versão anterior foi guardada no histórico."); setModo("ler");
    } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Guia do PROJUDI</h1>
          <p className="text-sm text-slate-500">Rotinas do gabinete no PROJUDI: movimentações, códigos, expedientes e passo a passo para a equipe.</p>
        </div>
        {podeEditar && <Segmented label="Modo" value={modo} onChange={setModo} options={[{ value: "ler", label: "Consultar" }, { value: "editar", label: "Editar" }]} />}
      </div>
      <ErrorBox erro={erro} />
      {ok && <Notice tone="ok">{ok}</Notice>}

      {modo === "editar" ? (
        <Card title="Editor do guia" bodyClass="space-y-3 p-4" actions={<Badge>{texto.length.toLocaleString("pt-BR")} caracteres</Badge>}>
          <p className="text-xs text-slate-500">Separe cada rotina por uma linha em branco: cada bloco vira um resultado na busca.</p>
          <textarea rows={22} className={`${inputCls} font-mono text-xs leading-relaxed`} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder={"CONCLUSÃO PARA SENTENÇA\nMovimentar como “Conclusos para sentença” após certificar o decurso do prazo de réplica.\n\nJUNTADA DE AR NEGATIVO\n1. Certificar o resultado da diligência.\n2. Intimar a parte autora para indicar novo endereço em 5 dias."} />
          <div className="flex flex-wrap gap-2">
            <Button loading={salvando} disabled={texto === salvo} onClick={() => void salvar()}><Save className="h-4 w-4" /> Salvar guia</Button>
            <Button variant="ghost" disabled={texto === salvo} onClick={() => setTexto(salvo)}>Descartar alterações</Button>
          </div>
        </Card>
      ) : (
        <Card bodyClass="space-y-4 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar rotina, movimento ou código (ex.: conclusão sentença, AR negativo)" className={`${inputCls} pl-9`} />
          </div>
          {salvo ? (
            <>
              <p className="text-xs text-slate-500">{achadas.length} de {secoes.length} rotina(s){meta ? ` · atualizado em ${new Date(meta).toLocaleString("pt-BR")}` : ""}</p>
              <div className="space-y-3">
                {achadas.map((s, i) => (
                  <div key={i} className="group relative rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <button type="button" onClick={() => void navigator.clipboard.writeText(s).then(() => setOk("Rotina copiada."), () => {})} className="absolute right-2 top-2 rounded p-1 text-slate-400 opacity-0 hover:bg-slate-100 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-800" aria-label="Copiar rotina"><ClipboardCopy className="h-4 w-4" /></button>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">{realce(s)}</p>
                  </div>
                ))}
                {achadas.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhuma rotina com esses termos.</p>}
              </div>
            </>
          ) : (
            <EmptyState icon={<FileText className="h-6 w-6" />} title="Guia ainda vazio">{podeEditar ? "Clique em Editar e cole as rotinas do gabinete." : "O Juiz Titular ainda não cadastrou as rotinas do gabinete."}</EmptyState>
          )}
        </Card>
      )}
    </div>
  );
}
