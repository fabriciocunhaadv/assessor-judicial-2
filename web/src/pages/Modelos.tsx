import { ClipboardCopy, Plus, Save, Scale, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Notice, Tabs } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useGabinete } from "../lib/gabinete";

/** Teses do gabinete e Minutas Paradigma (espelho estrutural do magistrado). */
export default function Modelos() {
  const { pode } = useAuth();
  const { teses, paradigmas, recarregar } = useGabinete();
  const navigate = useNavigate();
  const [aba, setAba] = useState<"caderno" | "paradigmas" | "teses">("caderno");
  const [caderno, setCaderno] = useState("");
  const [cadernoSalvo, setCadernoSalvo] = useState("");
  const [cadernoInfo, setCadernoInfo] = useState<{ atualizadoEm: number } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  useEffect(() => {
    api.get<{ texto: string; atualizadoEm: number }>("/gabinete/caderno").then((c) => { setCaderno(c.texto); setCadernoSalvo(c.texto); setCadernoInfo(c.atualizadoEm ? { atualizadoEm: c.atualizadoEm } : null); }).catch((e) => setErro(e.message));
  }, []);
  const topicos = (caderno.match(/^\s*\d+(\.\d+)*\s*[-.)]/gm) ?? []).length;
  const novoLancamento = () => setCaderno((t) => `${t.trimEnd()}${t.trim() ? "\n\n" : ""}N. TEMA\n\nN.1. Hipótese:\n  - \n\nN.2. Prova necessária:\n  - \n\nN.3. Exceções:\n  - \n`);
  const [novaTese, setNovaTese] = useState({ titulo: "", texto: "" });
  const [novoPar, setNovoPar] = useState({ titulo: "", tipoAto: "Sentença", texto: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async (fn: () => Promise<unknown>) => {
    setErro(null); setSalvando(true);
    try { await fn(); await recarregar(); } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  };
  const injetar = (id: string) => {
    try { sessionStorage.setItem("paradigmaInjetado", id); localStorage.setItem("assessor.modo", "avancado"); } catch { /* */ }
    navigate("/");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Teses & Modelos</h1>
        <p className="text-sm text-slate-500">Paradigmas do magistrado e o Caderno de Teses que entram em toda minuta do gabinete.</p>
      </div>
      <Tabs value={aba} onChange={(a) => { setAba(a); setOk(null); }} tabs={[{ value: "caderno", label: "Caderno de Teses" }, { value: "paradigmas", label: "Modelos de decisões (paradigmas)", count: paradigmas.length }, { value: "teses", label: "Teses avulsas", count: teses.length }]} />
      <ErrorBox erro={erro} />
      {ok && <Notice tone="ok">{ok}</Notice>}

      {aba === "caderno" && (
        <div className="space-y-4">
          <Notice tone="warn"><strong>Como funciona:</strong> as regras e teses deste caderno entram <strong>obrigatoriamente em todas as análises e minutas</strong> do gabinete, qualquer que seja o prompt escolhido. Use-o para regras gerais: comandos padronizados do juízo, teses pacificadas (ex.: dano moral), regras de citação e parâmetros de custas. Para clonar o formato de sentenças específicas, use os Modelos de decisões.</Notice>
          <Card title="Editor de teses e hipóteses do juízo" bodyClass="space-y-3 p-4" actions={<>
            <Badge tone="amber">{topicos} tópico(s)</Badge>
            {pode("gabinete:teses_editar") && <Button size="sm" variant="ghost" onClick={novoLancamento}><Plus className="h-3.5 w-3.5" /> Inserir novo lançamento</Button>}
            <Button size="sm" variant="ghost" disabled={!caderno} onClick={() => void navigator.clipboard.writeText(caderno).then(() => setOk("Caderno copiado."), () => {})}><ClipboardCopy className="h-3.5 w-3.5" /> Copiar tudo</Button>
          </>}>
            <textarea rows={22} readOnly={!pode("gabinete:teses_editar")} className={`${inputCls} font-mono text-xs leading-relaxed`} value={caderno} onChange={(e) => setCaderno(e.target.value)}
              placeholder={"1 - JUIZADO ESPECIAL CÍVEL\n\n1. CONTRATOS BANCÁRIOS / EMPRÉSTIMO CONSIGNADO\n\n1.1. Hipótese:\n  - Quando a instituição financeira comprovar a disponibilização do crédito e juntar contrato válido: JULGAR IMPROCEDENTES os pedidos.\n\n1.2. Prova necessária:\n  - Instrumento contratual com assinatura ou log de autenticação eletrônica.\n\n1.3. Exceções:\n  - …"} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{caderno.length.toLocaleString("pt-BR")} caracteres{cadernoInfo ? ` · salvo em ${new Date(cadernoInfo.atualizadoEm).toLocaleString("pt-BR")}` : ""}{caderno !== cadernoSalvo ? " · alterações não salvas" : ""}. Cada gravação guarda a versão anterior no histórico.</p>
              {pode("gabinete:teses_editar") && <Button loading={salvando} disabled={caderno === cadernoSalvo} onClick={() => salvar(async () => { const c = await api.post<{ texto: string; atualizadoEm: number }>("/gabinete/caderno", { texto: caderno }, "PUT"); setCadernoSalvo(c.texto); setCadernoInfo({ atualizadoEm: c.atualizadoEm }); setOk("Caderno salvo."); })}><Save className="h-4 w-4" /> Salvar alterações no Caderno</Button>}
            </div>
          </Card>
        </div>
      )}

      {aba === "paradigmas" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Card title="Paradigmas cadastrados" bodyClass="divide-y divide-slate-100 dark:divide-slate-800">
            {paradigmas.length ? paradigmas.map((p) => (
              <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{p.titulo} <Badge>{p.tipoAto}</Badge></p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.texto}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => injetar(p.id)}><Zap className="h-3.5 w-3.5 text-amber-500" /> Injetar no Prompt</Button>
              </div>
            )) : <EmptyState icon={<Scale className="h-6 w-6" />} title="Nenhum paradigma cadastrado">Cole uma decisão anterior do magistrado para que as minutas sigam o mesmo estilo, a mesma ordem de tópicos e o mesmo formato de dispositivo.</EmptyState>}
          </Card>
          {pode("gabinete:paradigmas_editar") ? (
            <Card title="Novo paradigma" bodyClass="space-y-3 p-4">
              <Field label="Título"><input className={inputCls} value={novoPar.titulo} onChange={(e) => setNovoPar({ ...novoPar, titulo: e.target.value })} placeholder="Sentença JEC — dano moral bancário" /></Field>
              <Field label="Tipo de ato"><input className={inputCls} value={novoPar.tipoAto} onChange={(e) => setNovoPar({ ...novoPar, tipoAto: e.target.value })} /></Field>
              <Field label="Íntegra da decisão"><textarea rows={9} className={inputCls} value={novoPar.texto} onChange={(e) => setNovoPar({ ...novoPar, texto: e.target.value })} /></Field>
              <Button loading={salvando} disabled={novoPar.titulo.length < 3 || novoPar.texto.length < 200} onClick={() => salvar(async () => { await api.post("/gabinete/paradigmas", novoPar, "PUT"); setNovoPar({ titulo: "", tipoAto: "Sentença", texto: "" }); })}>Adicionar paradigma</Button>
            </Card>
          ) : <p className="text-sm text-slate-500">Só o Juiz Titular altera paradigmas.</p>}
        </div>
      )}

      {aba === "teses" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Card title="Teses do gabinete" bodyClass="divide-y divide-slate-100 dark:divide-slate-800">
            {teses.length ? teses.map((t) => (
              <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t.titulo} <Badge tone={t.ativa === false ? "slate" : "green"}>{t.ativa === false ? "inativa" : "ativa"}</Badge></p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.texto}</p>
                </div>
                {pode("gabinete:teses_editar") && <Button size="sm" variant="ghost" onClick={() => salvar(() => api.post(`/gabinete/teses/${t.id}`, { ...t, ativa: t.ativa === false }, "PUT"))}>{t.ativa === false ? "Reativar" : "Desativar"}</Button>}
              </div>
            )) : <EmptyState icon={<Scale className="h-6 w-6" />} title="Nenhuma tese cadastrada">As teses ativas entram em toda minuta como entendimento do juízo.</EmptyState>}
          </Card>
          {pode("gabinete:teses_editar") ? (
            <Card title="Nova tese" bodyClass="space-y-3 p-4">
              <Field label="Título"><input className={inputCls} value={novaTese.titulo} onChange={(e) => setNovaTese({ ...novaTese, titulo: e.target.value })} /></Field>
              <Field label="Entendimento do juízo"><textarea rows={6} className={inputCls} value={novaTese.texto} onChange={(e) => setNovaTese({ ...novaTese, texto: e.target.value })} /></Field>
              <Button loading={salvando} disabled={novaTese.titulo.length < 3 || novaTese.texto.length < 10} onClick={() => salvar(async () => { await api.post("/gabinete/teses", { ...novaTese, ativa: true }, "PUT"); setNovaTese({ titulo: "", texto: "" }); })}>Adicionar tese</Button>
            </Card>
          ) : <p className="text-sm text-slate-500">Só o Juiz Titular altera o Caderno de Teses.</p>}
        </div>
      )}
    </div>
  );
}
