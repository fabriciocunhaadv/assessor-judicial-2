import { Building2, Mail, Megaphone, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AREAS } from "@shared/gabinete";
import { ROLE_LABEL, ROLES, roleRank, type Role } from "@shared/roles";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Notice, Segmented, Tabs } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useGabinete, type Unidade } from "../lib/gabinete";

interface Membro { uid: string; email: string; nome: string; role: string; ativo: boolean; unidadesLiberadas?: string[] }
interface Convite { email: string; nome: string; role: string; unidadesLiberadas: string[]; criadoEm: number }

const tomPapel = (r: string): "amber" | "violet" | "sky" | "slate" => (r === "juiz_titular" ? "amber" : r === "super_admin" ? "violet" : r === "assessor" ? "sky" : "slate");

/** Administração do Gabinete: membros e convites, lotações e aviso para a equipe. */
export default function Equipe() {
  const { perfil } = useAuth();
  const { recarregar } = useGabinete();
  const [aba, setAba] = useState<"membros" | "lotacoes" | "aviso">("membros");
  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [convite, setConvite] = useState({ email: "", nome: "", role: "assessor", unidadesLiberadas: [] as string[] });
  const [nova, setNova] = useState({ nome: "", comarca: "", competencia: AREAS[0] as string });
  const [aviso, setAviso] = useState({ texto: "", nivel: "info" as "info" | "alerta" });
  const [ocupado, setOcupado] = useState(false);

  const papeisConcedíveis = ROLES.filter((r) => r !== "super_admin" && (perfil?.role === "super_admin" || roleRank(r) < roleRank(perfil!.role)));

  const carregar = async () => {
    try {
      const [eq, un] = await Promise.all([api.get<{ membros: Membro[]; convites: Convite[] }>("/gabinete/equipe"), api.get<Unidade[]>("/gabinete/unidades/todas")]);
      setMembros(eq.membros.sort((a, b) => roleRank(b.role as Role) - roleRank(a.role as Role) || a.nome.localeCompare(b.nome)));
      setConvites(eq.convites);
      setUnidades(un.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (e) { setErro((e as Error).message); }
  };
  useEffect(() => { void carregar(); }, []);

  const agir = async (fn: () => Promise<unknown>, msg?: string) => {
    setErro(null); setOk(null); setOcupado(true);
    try { await fn(); await carregar(); await recarregar(); if (msg) setOk(msg); } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? id;
  const ativas = unidades.filter((u) => u.ativa !== false);

  const Unidades = ({ valor, onChange }: { valor: string[]; onChange(v: string[]): void }) => (
    <div className="flex flex-wrap gap-1.5">
      {ativas.length === 0 && <span className="text-xs text-slate-500">Cadastre as lotações na aba Lotações.</span>}
      {ativas.map((u) => {
        const on = valor.includes(u.id);
        return <button key={u.id} type="button" aria-pressed={on} onClick={() => onChange(on ? valor.filter((x) => x !== u.id) : [...valor, u.id])}
          className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "border-slate-300 text-slate-500 dark:border-slate-700"}`}>{u.nome}</button>;
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Administração do Gabinete</h1>
        <p className="text-sm text-slate-500">Controle de acessos, convites, lotações e avisos da equipe de {perfil?.gabineteNome}.</p>
      </div>
      <Tabs value={aba} onChange={(a) => { setAba(a); setErro(null); setOk(null); }} tabs={[
        { value: "membros", label: <><Users className="h-4 w-4" /> Membros da equipe</>, count: membros.length },
        { value: "lotacoes", label: <><Building2 className="h-4 w-4" /> Lotações / Comarcas</>, count: ativas.length },
        { value: "aviso", label: <><Megaphone className="h-4 w-4" /> Aviso à equipe</> },
      ]} />
      <ErrorBox erro={erro} />
      {ok && <Notice tone="ok">{ok}</Notice>}

      {aba === "membros" && (
        <div className="space-y-4">
          <Card title="Convidar novo membro" icon={<UserPlus className="h-4 w-4 text-emerald-600" />} bodyClass="space-y-3 p-4">
            <p className="text-sm text-slate-500">Digite o e-mail Google do assessor, estagiário ou juiz. O acesso é liberado automaticamente no primeiro login com esse e-mail.</p>
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)]">
              <Field label="E-mail"><input type="email" className={inputCls} value={convite.email} onChange={(e) => setConvite({ ...convite, email: e.target.value })} placeholder="assessor@gmail.com" /></Field>
              <Field label="Nome (opcional)"><input className={inputCls} value={convite.nome} onChange={(e) => setConvite({ ...convite, nome: e.target.value })} /></Field>
              <Field label="Papel">
                <select className={inputCls} value={convite.role} onChange={(e) => setConvite({ ...convite, role: e.target.value })}>{papeisConcedíveis.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
              </Field>
            </div>
            <Field label="Unidades liberadas" hint="nenhuma marcada = todas"><Unidades valor={convite.unidadesLiberadas} onChange={(v) => setConvite({ ...convite, unidadesLiberadas: v })} /></Field>
            <Button loading={ocupado} disabled={!/.+@.+\..+/.test(convite.email)} onClick={() => agir(async () => { await api.post("/gabinete/convites", convite); setConvite({ email: "", nome: "", role: "assessor", unidadesLiberadas: [] }); }, "Convite registrado. O acesso é liberado no primeiro login com esse e-mail.")}>
              <Mail className="h-4 w-4" /> Liberar acesso
            </Button>
          </Card>

          <Card title="Membros vinculados" bodyClass="divide-y divide-slate-100 dark:divide-slate-800">
            {membros.length === 0 && convites.length === 0 && <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum membro ainda">Convide a equipe pelo e-mail acima.</EmptyState>}
            {membros.map((m) => {
              const souEu = m.uid === perfil?.uid;
              const podeMexer = !souEu && (perfil?.role === "super_admin" || roleRank(m.role as Role) < roleRank(perfil!.role));
              return (
                <div key={m.uid} className={`space-y-2 p-4 ${m.role === "juiz_titular" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{m.nome.slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">{m.nome} {souEu && <Badge tone="violet">Você</Badge>} <Badge tone={tomPapel(m.role)}>{ROLE_LABEL[m.role as Role] ?? m.role}</Badge> <Badge tone={m.ativo === false ? "red" : "green"}>{m.ativo === false ? "suspenso" : "ativo"}</Badge></p>
                        <p className="truncate font-mono text-xs text-slate-500">{m.email}</p>
                      </div>
                    </div>
                    {podeMexer && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select aria-label={`Papel de ${m.nome}`} className={`${inputCls} w-auto py-1.5 text-xs`} value={m.role} onChange={(e) => agir(() => api.post(`/gabinete/equipe/${m.uid}`, { role: e.target.value }, "PATCH"), "Papel atualizado.")}>
                          {papeisConcedíveis.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                        <Button size="sm" variant={m.ativo === false ? "ghost" : "danger"} onClick={() => agir(() => api.post(`/gabinete/equipe/${m.uid}`, { ativo: m.ativo === false }, "PATCH"), m.ativo === false ? "Acesso reativado." : "Acesso suspenso.")}>{m.ativo === false ? "Reativar" : "Desativar"}</Button>
                      </div>
                    )}
                  </div>
                  <div className="pl-12">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Unidades liberadas</p>
                    {podeMexer ? <Unidades valor={m.unidadesLiberadas ?? []} onChange={(v) => agir(() => api.post(`/gabinete/equipe/${m.uid}`, { unidadesLiberadas: v }, "PATCH"))} />
                      : <p className="text-xs text-slate-500">{m.unidadesLiberadas?.length ? m.unidadesLiberadas.map(nomeUnidade).join(" · ") : "Todas as unidades do gabinete"}</p>}
                  </div>
                </div>
              );
            })}
            {convites.map((c) => (
              <div key={c.email} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">{c.nome || c.email} <Badge tone="amber">convite pendente</Badge> <Badge tone={tomPapel(c.role)}>{ROLE_LABEL[c.role as Role] ?? c.role}</Badge></p>
                  <p className="truncate font-mono text-xs text-slate-500">{c.email} · {c.unidadesLiberadas.length ? c.unidadesLiberadas.map(nomeUnidade).join(", ") : "todas as unidades"}</p>
                </div>
                <Button size="sm" variant="danger" onClick={() => agir(() => api.del(`/gabinete/convites/${encodeURIComponent(c.email)}`), "Convite revogado.")}><Trash2 className="h-3.5 w-3.5" /> Revogar</Button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {aba === "lotacoes" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <Card title="Unidades judiciárias" bodyClass="divide-y divide-slate-100 dark:divide-slate-800">
            {unidades.length ? unidades.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-medium text-slate-900 dark:text-slate-100">{u.nome} {u.ativa === false && <Badge>inativa</Badge>}</p><p className="text-sm text-slate-500">Comarca de {u.comarca} · {u.competencia}</p></div>
                <Button size="sm" variant="ghost" onClick={() => agir(() => api.post(`/gabinete/unidades/${u.id}`, { ...u, ativa: u.ativa === false }, "PUT"))}>{u.ativa === false ? "Reativar" : "Desativar"}</Button>
              </div>
            )) : <EmptyState icon={<Building2 className="h-6 w-6" />} title="Nenhuma lotação cadastrada">Cadastre as varas e juizados em que o gabinete atua. A unidade escolhida no topo da tela orienta o rito e a competência das minutas.</EmptyState>}
          </Card>
          <Card title="Nova lotação" bodyClass="space-y-3 p-4">
            <Field label="Nome da unidade"><input className={inputCls} value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Vara Única" /></Field>
            <Field label="Comarca"><input className={inputCls} value={nova.comarca} onChange={(e) => setNova({ ...nova, comarca: e.target.value })} placeholder="Nome da comarca" /></Field>
            <Field label="Competência"><select className={inputCls} value={nova.competencia} onChange={(e) => setNova({ ...nova, competencia: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Button loading={ocupado} disabled={nova.nome.length < 3 || nova.comarca.length < 2} onClick={() => agir(async () => { await api.post("/gabinete/unidades", { ...nova, ativa: true }, "PUT"); setNova({ nome: "", comarca: "", competencia: AREAS[0] }); }, "Lotação adicionada.")}>Adicionar lotação</Button>
          </Card>
        </div>
      )}

      {aba === "aviso" && (
        <Card title="Aviso para a equipe do gabinete" bodyClass="space-y-3 p-4">
          <p className="text-sm text-slate-500">Aparece no topo da tela de todos os membros do gabinete até ser desativado.</p>
          <textarea rows={3} className={inputCls} value={aviso.texto} onChange={(e) => setAviso({ ...aviso, texto: e.target.value })} placeholder="Ex.: Mutirão de sentenças do JEC nesta semana — priorizar os conclusos há mais de 100 dias." />
          <Segmented label="Tipo de aviso" value={aviso.nivel} onChange={(n) => setAviso({ ...aviso, nivel: n })} options={[{ value: "info", label: "Informativo" }, { value: "alerta", label: "Alerta" }]} />
          <div className="flex flex-wrap gap-2">
            <Button loading={ocupado} disabled={aviso.texto.trim().length < 3} onClick={() => agir(() => api.post("/gabinete/aviso", { ...aviso, ativo: true }, "PUT"), "Aviso publicado para a equipe.")}>Publicar aviso</Button>
            <Button variant="ghost" onClick={() => agir(() => api.post("/gabinete/aviso", { texto: "", nivel: "info", ativo: false }, "PUT"), "Aviso retirado.")}>Retirar aviso atual</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
