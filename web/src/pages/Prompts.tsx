import { Download, Sparkles, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { AREAS } from "@shared/gabinete";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Notice } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useGabinete, type PromptGabinete } from "../lib/gabinete";

const vazio = { titulo: "", area: AREAS[0] as string, texto: "", ativo: true };

/** Prompts do gabinete por área: instruções que entram na redação quando o prompt está ativo. */
export default function Prompts() {
  const { pode } = useAuth();
  const { promptId, setPromptId, recarregar } = useGabinete();
  const [todos, setTodos] = useState<PromptGabinete[]>([]);
  const [edit, setEdit] = useState<{ id?: string } & typeof vazio>(vazio);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const podeEditar = pode("gabinete:teses_editar");

  const carregar = () => api.get<PromptGabinete[]>("/gabinete/prompts").then((p) => setTodos([...p].sort((a, b) => a.area.localeCompare(b.area) || a.titulo.localeCompare(b.titulo)))).catch((e) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);

  async function salvar() {
    setErro(null); setSalvando(true);
    try {
      const { id, ...body } = edit;
      await api.post(`/gabinete/prompts${id ? `/${id}` : ""}`, body, "PUT");
      setEdit(vazio); await carregar(); await recarregar();
    } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  }

  /** Backup: baixa todos os prompts do gabinete em JSON. */
  function exportar() {
    const dados = todos.map(({ titulo, area, texto, ativo }) => ({ titulo, area, texto, ativo }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ tipo: "assessor-judicial/prompts", versao: 1, exportadoEm: new Date().toISOString(), prompts: dados }, null, 2)], { type: "application/json" }));
    a.download = `prompts-gabinete-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** Importa como NOVOS prompts: nada existente é alterado; títulos repetidos na mesma área são ignorados. */
  async function importar(f?: File) {
    if (!f) return;
    setErro(null); setInfo(null); setSalvando(true);
    try {
      const json = JSON.parse(await f.text());
      const lista: unknown[] = Array.isArray(json) ? json : json?.prompts;
      if (!Array.isArray(lista)) throw new Error("Arquivo sem a lista de prompts.");
      const existentes = new Set(todos.map((p) => `${p.area}|${p.titulo}`.toLowerCase()));
      let novos = 0, ignorados = 0;
      for (const item of lista) {
        const p = item as Partial<PromptGabinete>;
        const area = AREAS.includes(p.area as (typeof AREAS)[number]) ? (p.area as string) : "Outros";
        if (!p.titulo || !p.texto || existentes.has(`${area}|${p.titulo}`.toLowerCase())) { ignorados++; continue; }
        await api.post("/gabinete/prompts", { titulo: String(p.titulo).slice(0, 200), area, texto: String(p.texto).slice(0, 30_000), ativo: p.ativo !== false }, "PUT");
        novos++;
      }
      setInfo(`${novos} prompt(s) importado(s)${ignorados ? `, ${ignorados} ignorado(s) por já existirem ou estarem incompletos` : ""}.`);
      await carregar(); await recarregar();
    } catch (e) { setErro(`Não foi possível importar: ${(e as Error).message}`); } finally { setSalvando(false); }
  }

  const areas = Array.from(new Set(todos.map((p) => p.area)));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-900 dark:text-white">Prompts por área</h1>
        <p className="text-sm text-stone-500">Instruções próprias do gabinete para cada matéria. O prompt ativo entra na redação da minuta junto com as regras fixas do sistema.</p>
      </div>
      <ErrorBox erro={erro} />
      {info && <Notice tone="ok">{info}</Notice>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <Card title={`Prompts do gabinete (${todos.length})`} bodyClass="space-y-5 p-4" actions={<>
          {podeEditar && <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 ${salvando ? "pointer-events-none opacity-50" : ""}`}><Upload className="h-3.5 w-3.5" /> Importar JSON<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = ""; }} /></label>}
          <Button size="sm" variant="ghost" disabled={!todos.length} onClick={exportar}><Download className="h-3.5 w-3.5" /> Backup JSON</Button>
        </>}>
          {todos.length ? areas.map((a) => (
            <div key={a} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{a}</p>
              {todos.filter((p) => p.area === a).map((p) => (
                <div key={p.id} className={`rounded-lg border p-3 ${promptId === p.id ? "border-clay-400 bg-clay-50/50 dark:border-clay-700 dark:bg-clay-950/30" : "border-stone-200 dark:border-stone-800"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium text-stone-900 dark:text-stone-100"><Badge tone="slate">{p.area}</Badge> {p.titulo} {p.ativo === false && <Badge>inativo</Badge>} {promptId === p.id && <Badge tone="green">✓ Em uso</Badge>}</p>
                    <div className="flex gap-2">
                      {p.ativo !== false && (promptId === p.id ? <Button size="sm" variant="dark" onClick={() => setPromptId("")}>Ativo</Button> : <Button size="sm" variant="ghost" onClick={() => setPromptId(p.id)}>Selecionar</Button>)}
                      {podeEditar && <Button size="sm" variant="subtle" onClick={() => setEdit({ id: p.id, titulo: p.titulo, area: p.area, texto: p.texto, ativo: p.ativo !== false })}>Editar</Button>}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-stone-500">{p.texto}</p>
                </div>
              ))}
            </div>
          )) : <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Nenhum prompt cadastrado">Sem prompt de área, a minuta segue só as regras fixas do sistema. Cadastre instruções por matéria, como "JEC — consumidor bancário" ou "Criminal — dosimetria".</EmptyState>}
        </Card>
        {podeEditar ? (
          <Card title={edit.id ? "Editar prompt" : "Novo prompt"} bodyClass="space-y-3 p-4" actions={edit.id && <Button size="sm" variant="subtle" onClick={() => setEdit(vazio)}>Cancelar</Button>}>
            <Field label="Título"><input className={inputCls} value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} placeholder="JEC — consumidor bancário" /></Field>
            <Field label="Área">
              <select className={inputCls} value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
            </Field>
            <Field label="Instruções" hint={`${edit.texto.length.toLocaleString("pt-BR")} / 30.000`}>
              <textarea rows={12} className={`${inputCls} font-mono text-xs`} value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} placeholder={"Ex.:\n1. Aplique os Enunciados do FONAJE pertinentes.\n2. Em desconto indevido de benefício, examine a Súmula 479/STJ.\n3. Fixe o dano moral pelos parâmetros do juízo."} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200"><input type="checkbox" className="accent-clay-600" checked={edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} /> Disponível para a equipe</label>
            <Button loading={salvando} disabled={edit.titulo.length < 3 || edit.texto.length < 20} onClick={salvar}>{edit.id ? "Salvar alterações" : "Adicionar prompt"}</Button>
            <p className="text-xs text-stone-500">Cada alteração guarda a versão anterior no histórico. Nada é apagado.</p>
          </Card>
        ) : <p className="text-sm text-stone-500">Só o Juiz Titular cria e altera prompts. Você pode escolher qual usar.</p>}
      </div>
    </div>
  );
}
