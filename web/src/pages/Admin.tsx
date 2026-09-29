import { Building2, Coins, Cpu, FileText, Megaphone, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ROLE_LABEL, ROLES, type Role } from "@shared/roles";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Notice, Segmented, Tabs } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useGabinete } from "../lib/gabinete";

interface Resumo { gabinetes: { total: number; ativos: number }; usuarios: { total: number; ativos: number }; minutas: number; comunicadoAtivo: boolean }
interface Gab { id: string; nome: string; juizTitular: string; status: "ativo" | "suspenso"; criadoEm: number; membros: number }
interface Usuario { uid: string; email: string; nome: string; role: string; tenantId: string; ativo: boolean }
interface Agregado { chamadas: number; entrada: number; saida: number; usd: number; brl: number }
interface Consumo { periodoDias: number; cotacaoUsdBrl: number; total: { chamadas: number; usd: number; brl: number }; porFuncionalidade: Record<string, Agregado>; porModelo: Record<string, Agregado>; porGabinete: Record<string, Agregado>; modelosSemPreco: string[] }

const FUNC: Record<string, string> = { minuta: "Minutas", lupa: "Lupa do Magistrado", audiencia: "Mesa de Audiência", chat: "Chat", precedentes: "Importação de precedentes", sinopse: "Resumo Executivo" };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function Kpi({ icon, rotulo, valor, detalhe }: { icon: ReactNode; rotulo: string; valor: ReactNode; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{valor}</p>
      {detalhe && <p className="text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

export default function Admin() {
  const { perfil } = useAuth();
  const { recarregar } = useGabinete();
  const [aba, setAba] = useState<"gabinetes" | "usuarios" | "comunicado" | "consumo">("gabinetes");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [gabs, setGabs] = useState<Gab[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [consumo, setConsumo] = useState<Consumo | null>(null);
  const [cascata, setCascata] = useState<{ provider: string; models: string[]; keys: number }[]>([]);
  const [dias, setDias] = useState(30);
  const [busca, setBusca] = useState("");
  const [filtroGab, setFiltroGab] = useState("");
  const [novo, setNovo] = useState({ id: "", nome: "", juizTitular: "" });
  const [com, setCom] = useState({ texto: "", nivel: "info" as "info" | "alerta" });
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const [r, g, u, m] = await Promise.all([api.get<Resumo>("/admin/resumo"), api.get<Gab[]>("/admin/gabinetes"), api.get<Usuario[]>("/admin/usuarios"), api.get<{ cascata: typeof cascata }>("/admin/motor")]);
      setResumo(r); setGabs(g.sort((a, b) => a.nome.localeCompare(b.nome))); setUsuarios(u.sort((a, b) => a.nome.localeCompare(b.nome))); setCascata(m.cascata);
    } catch (e) { setErro((e as Error).message); }
  };
  useEffect(() => { void carregar(); }, []);
  useEffect(() => { api.get<Consumo>(`/admin/consumo?dias=${dias}`).then(setConsumo).catch((e) => setErro(e.message)); }, [dias]);

  const agir = async (fn: () => Promise<unknown>, msg: string) => {
    setErro(null); setOk(null);
    try { await fn(); await carregar(); await recarregar(); setOk(msg); } catch (e) { setErro((e as Error).message); }
  };
  const nomeGab = (id: string) => gabs.find((g) => g.id === id)?.nome ?? id;
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return usuarios.filter((u) => (!filtroGab || u.tenantId === filtroGab) && (!q || `${u.nome} ${u.email}`.toLowerCase().includes(q)));
  }, [usuarios, busca, filtroGab]);

  const Tabela = ({ titulo, dados, rotulo = (k: string) => k }: { titulo: string; dados: Record<string, Agregado>; rotulo?: (k: string) => string }) => (
    <Card title={titulo} bodyClass="overflow-x-auto p-0">
      <table className="w-full text-right text-sm tabular-nums">
        <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left">Item</th><th className="px-2">Chamadas</th><th className="px-2">Entrada</th><th className="px-2">Saída</th><th className="px-2">USD</th><th className="px-4">R$</th></tr></thead>
        <tbody>{Object.entries(dados).sort((a, b) => b[1].usd - a[1].usd).map(([k, v]) => (
          <tr key={k} className="border-t border-slate-100 dark:border-slate-800"><td className="px-4 py-2 text-left">{rotulo(k)}</td><td className="px-2">{v.chamadas}</td><td className="px-2">{v.entrada.toLocaleString("pt-BR")}</td><td className="px-2">{v.saida.toLocaleString("pt-BR")}</td><td className="px-2">{usd(v.usd)}</td><td className="px-4">{brl(v.brl)}</td></tr>
        ))}</tbody>
      </table>
      {Object.keys(dados).length === 0 && <p className="px-4 pb-4 text-sm text-slate-500">Sem chamadas no período.</p>}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Painel Super Admin</h1>
        <p className="text-sm text-slate-500">Governança multi-gabinete, usuários, comunicados e consumo do motor de IA.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={<Building2 className="h-4 w-4" />} rotulo="Gabinetes" valor={resumo?.gabinetes.total ?? "—"} detalhe={resumo ? `${resumo.gabinetes.ativos} ativos` : undefined} />
        <Kpi icon={<Users className="h-4 w-4" />} rotulo="Usuários" valor={resumo?.usuarios.total ?? "—"} detalhe={resumo ? `${resumo.usuarios.ativos} ativos` : undefined} />
        <Kpi icon={<FileText className="h-4 w-4" />} rotulo="Minutas geradas" valor={resumo?.minutas ?? "—"} />
        <Kpi icon={<Coins className="h-4 w-4" />} rotulo={`Custo · ${dias} dias`} valor={consumo ? brl(consumo.total.brl) : "—"} detalhe={consumo ? `${usd(consumo.total.usd)} · ${consumo.total.chamadas} chamadas` : undefined} />
        <Kpi icon={<Megaphone className="h-4 w-4" />} rotulo="Comunicado" valor={resumo ? (resumo.comunicadoAtivo ? "Ativo" : "Inativo") : "—"} />
      </div>

      <Tabs value={aba} onChange={(a) => { setAba(a); setErro(null); setOk(null); }} tabs={[
        { value: "gabinetes", label: "Gabinetes", count: gabs.length },
        { value: "usuarios", label: "Usuários globais", count: usuarios.length },
        { value: "comunicado", label: "Comunicado" },
        { value: "consumo", label: "Consumo & motor de IA" },
      ]} />
      <ErrorBox erro={erro} />
      {ok && <Notice tone="ok">{ok}</Notice>}

      {aba === "gabinetes" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <Card title="Gabinetes contratantes" bodyClass="overflow-x-auto p-0">
            {gabs.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">Gabinete</th><th className="px-2">Juiz(a) titular</th><th className="px-2">Membros</th><th className="px-2">Status</th><th className="px-4" /></tr></thead>
                <tbody>{gabs.map((g) => (
                  <tr key={g.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2.5"><p className="font-medium text-slate-900 dark:text-slate-100">{g.nome}</p><p className="font-mono text-xs text-slate-500">{g.id}</p></td>
                    <td className="px-2">{g.juizTitular || "—"}</td>
                    <td className="px-2 tabular-nums">{g.membros}</td>
                    <td className="px-2"><Badge tone={g.status === "suspenso" ? "red" : "green"}>{g.status}</Badge></td>
                    <td className="px-4 text-right"><Button size="sm" variant={g.status === "suspenso" ? "ghost" : "danger"} onClick={() => agir(() => api.post(`/admin/gabinetes/${g.id}`, { nome: g.nome, juizTitular: g.juizTitular, status: g.status === "suspenso" ? "ativo" : "suspenso" }, "PUT"), g.status === "suspenso" ? "Gabinete reativado." : "Gabinete suspenso.")}>{g.status === "suspenso" ? "Reativar" : "Suspender"}</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <EmptyState icon={<Building2 className="h-6 w-6" />} title="Nenhum gabinete cadastrado">Crie o primeiro gabinete ao lado e convide o Juiz Titular pela tela de Equipe desse gabinete.</EmptyState>}
          </Card>
          <Card title="Novo gabinete" bodyClass="space-y-3 p-4">
            <Field label="Identificador" hint="ex.: gab_vara_unica"><input className={`${inputCls} font-mono`} value={novo.id} onChange={(e) => setNovo({ ...novo, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} /></Field>
            <Field label="Nome"><input className={inputCls} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Gabinete da Vara Única" /></Field>
            <Field label="Juiz(a) titular"><input className={inputCls} value={novo.juizTitular} onChange={(e) => setNovo({ ...novo, juizTitular: e.target.value })} /></Field>
            <Button disabled={novo.id.length < 3 || novo.nome.length < 3} onClick={() => agir(async () => { await api.post(`/admin/gabinetes/${novo.id}`, { nome: novo.nome, juizTitular: novo.juizTitular, status: "ativo" }, "PUT"); setNovo({ id: "", nome: "", juizTitular: "" }); }, "Gabinete criado.")}>Criar gabinete</Button>
            <p className="text-xs text-slate-500">Seu próprio usuário está no gabinete <strong>{perfil?.gabineteNome}</strong>. Para administrar a equipe de outro gabinete, transfira-se em Usuários globais.</p>
          </Card>
        </div>
      )}

      {aba === "usuarios" && (
        <Card title="Usuários globais" bodyClass="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <input className={inputCls} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail…" />
            <select className={inputCls} value={filtroGab} onChange={(e) => setFiltroGab(e.target.value)}><option value="">Todos os gabinetes</option>{gabs.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-2">Usuário</th><th className="px-2">Gabinete</th><th className="px-2">Papel</th><th className="px-2">Status</th></tr></thead>
              <tbody>{lista.map((u) => {
                const eu = u.uid === perfil?.uid;
                return (
                  <tr key={u.uid} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2.5 pr-2"><p className="font-medium text-slate-900 dark:text-slate-100">{u.nome} {eu && <Badge tone="violet">Você</Badge>}</p><p className="font-mono text-xs text-slate-500">{u.email}</p></td>
                    <td className="px-2">{eu ? nomeGab(u.tenantId) : (
                      <select aria-label={`Gabinete de ${u.nome}`} className={`${inputCls} py-1.5 text-xs`} value={u.tenantId} onChange={(e) => agir(() => api.post(`/admin/usuarios/${u.uid}`, { tenantId: e.target.value }, "PATCH"), `${u.nome} transferido(a).`)}>
                        {!gabs.some((g) => g.id === u.tenantId) && <option value={u.tenantId}>{u.tenantId}</option>}
                        {gabs.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                      </select>)}</td>
                    <td className="px-2">{eu ? <Badge tone="violet">{ROLE_LABEL[u.role as Role] ?? u.role}</Badge> : (
                      <select aria-label={`Papel de ${u.nome}`} className={`${inputCls} py-1.5 text-xs`} value={u.role} onChange={(e) => agir(() => api.post(`/admin/usuarios/${u.uid}`, { role: e.target.value }, "PATCH"), "Papel atualizado.")}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>)}</td>
                    <td className="px-2">{eu ? <Badge tone="green">ativo</Badge> : <Button size="sm" variant={u.ativo === false ? "ghost" : "danger"} onClick={() => agir(() => api.post(`/admin/usuarios/${u.uid}`, { ativo: u.ativo === false }, "PATCH"), u.ativo === false ? "Acesso reativado." : "Acesso suspenso.")}>{u.ativo === false ? "Reativar" : "Desativar"}</Button>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
            {lista.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum usuário encontrado.</p>}
          </div>
        </Card>
      )}

      {aba === "comunicado" && (
        <Card title="Comunicado geral" icon={<Megaphone className="h-4 w-4" />} bodyClass="space-y-3 p-4">
          <p className="text-sm text-slate-500">Exibido no topo da tela de todos os usuários de todos os gabinetes.</p>
          <textarea rows={3} className={inputCls} value={com.texto} onChange={(e) => setCom({ ...com, texto: e.target.value })} placeholder="Ex.: Nova versão no ar: tipo de minuta selecionável e prompts por área." />
          <Segmented label="Tipo" value={com.nivel} onChange={(n) => setCom({ ...com, nivel: n })} options={[{ value: "info", label: "Informativo" }, { value: "alerta", label: "Alerta" }]} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={com.texto.trim().length < 3} onClick={() => agir(() => api.post("/admin/comunicado", { ...com, ativo: true }, "PUT"), "Comunicado publicado.")}>Publicar</Button>
            <Button variant="ghost" onClick={() => agir(() => api.post("/admin/comunicado", { texto: "", nivel: "info", ativo: false }, "PUT"), "Comunicado retirado.")}>Retirar comunicado atual</Button>
          </div>
        </Card>
      )}

      {aba === "consumo" && (
        <div className="space-y-4">
          <Card title="Cascata do motor de IA" icon={<Cpu className="h-4 w-4" />}>
            {cascata.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{cascata.map((p) => <li key={p.provider}><strong>{p.provider}</strong>: {p.models.join(" → ")} <span className="text-slate-500">({p.keys} chave(s) no pool)</span></li>)}</ol>
              : <ErrorBox erro="Nenhum provedor de IA configurado. Preencha ANTHROPIC_API_KEYS e/ou GEMINI_API_KEYS no servidor." />}
          </Card>
          <div className="flex flex-wrap items-center gap-3">
            <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={`${inputCls} w-auto`}>{[1, 7, 30, 90].map((d) => <option key={d} value={d}>Últimos {d} dia(s)</option>)}</select>
            {consumo && <span className="text-sm text-slate-600 dark:text-slate-300">cotação {consumo.cotacaoUsdBrl.toFixed(2)}</span>}
          </div>
          {consumo && consumo.modelosSemPreco.length > 0 && <Notice tone="warn">Modelos sem preço cadastrado (custo contado como zero): {consumo.modelosSemPreco.join(", ")}. Atualize shared/pricing.ts.</Notice>}
          {consumo && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Tabela titulo="Por funcionalidade" dados={consumo.porFuncionalidade} rotulo={(k) => FUNC[k] ?? k} />
              <Tabela titulo="Por modelo" dados={consumo.porModelo} />
              <Tabela titulo="Por gabinete" dados={consumo.porGabinete} rotulo={nomeGab} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
