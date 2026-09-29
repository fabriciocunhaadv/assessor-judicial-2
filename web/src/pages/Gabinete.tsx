import { Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROLE_LABEL, ROLES } from "@shared/roles";
import { Badge, Button, Card, ErrorBox, textareaCls } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Tese { id: string; titulo: string; texto: string; ativa: boolean }
interface Paradigma { id: string; titulo: string; tipoAto: string; texto: string }
interface Membro { uid: string; email: string; nome: string; role: string; ativo: boolean }

export default function Gabinete() {
  const { pode } = useAuth();
  const navigate = useNavigate();
  const [teses, setTeses] = useState<Tese[]>([]);
  const [paradigmas, setParadigmas] = useState<Paradigma[]>([]);
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [novaTese, setNovaTese] = useState({ titulo: "", texto: "" });
  const [novoParadigma, setNovoParadigma] = useState({ titulo: "", tipoAto: "Sentença", texto: "" });
  const [membro, setMembro] = useState({ uid: "", email: "", nome: "", role: "assessor" });
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    try {
      setTeses(await api.get("/gabinete/teses"));
      setParadigmas(await api.get("/gabinete/paradigmas"));
      if (pode("gabinete:equipe_gerenciar")) setEquipe(await api.get("/gabinete/equipe"));
    } catch (e) { setErro((e as Error).message); }
  };
  useEffect(() => { void carregar(); }, []);

  const salvar = async (fn: () => Promise<unknown>) => {
    setErro(null);
    try { await fn(); await carregar(); } catch (e) { setErro((e as Error).message); }
  };

  const injetar = (id: string) => {
    sessionStorage.setItem("paradigmaInjetado", id);
    navigate("/");
  };

  return (
    <div className="space-y-4">
      <ErrorBox erro={erro} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Minutas Paradigma do magistrado">
          <ul className="mb-4 space-y-2">
            {paradigmas.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
                <span><strong>{p.titulo}</strong> <Badge>{p.tipoAto}</Badge></span>
                <Button variant="ghost" onClick={() => injetar(p.id)}><Zap className="h-4 w-4" /> Injetar no Prompt</Button>
              </li>
            ))}
          </ul>
          {pode("gabinete:paradigmas_editar") && (
            <div className="space-y-2">
              <input className={textareaCls} placeholder="Título (ex.: Sentença JEC — dano moral bancário)" value={novoParadigma.titulo} onChange={(e) => setNovoParadigma({ ...novoParadigma, titulo: e.target.value })} />
              <input className={textareaCls} placeholder="Tipo de ato" value={novoParadigma.tipoAto} onChange={(e) => setNovoParadigma({ ...novoParadigma, tipoAto: e.target.value })} />
              <textarea rows={6} className={textareaCls} placeholder="Cole a íntegra de uma decisão anterior do magistrado (estilo, ordem dos tópicos e dispositivo serão clonados)." value={novoParadigma.texto} onChange={(e) => setNovoParadigma({ ...novoParadigma, texto: e.target.value })} />
              <Button disabled={novoParadigma.texto.length < 200 || novoParadigma.titulo.length < 3} onClick={() => salvar(async () => { await api.post("/gabinete/paradigmas", novoParadigma, "PUT"); setNovoParadigma({ titulo: "", tipoAto: "Sentença", texto: "" }); })}>Adicionar paradigma</Button>
            </div>
          )}
        </Card>

        <Card title="Caderno de Teses do Gabinete">
          <ul className="mb-4 space-y-2 text-sm">
            {teses.map((t) => (
              <li key={t.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                <div className="flex items-center justify-between"><strong>{t.titulo}</strong>
                  {pode("gabinete:teses_editar") ? (
                    <Button variant="ghost" onClick={() => salvar(() => api.post(`/gabinete/teses/${t.id}`, { ...t, ativa: !t.ativa }, "PUT"))}>{t.ativa ? "Desativar" : "Reativar"}</Button>
                  ) : <Badge tone={t.ativa ? "green" : "slate"}>{t.ativa ? "ativa" : "inativa"}</Badge>}
                </div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{t.texto}</p>
              </li>
            ))}
          </ul>
          {pode("gabinete:teses_editar") && (
            <div className="space-y-2">
              <input className={textareaCls} placeholder="Título da tese" value={novaTese.titulo} onChange={(e) => setNovaTese({ ...novaTese, titulo: e.target.value })} />
              <textarea rows={4} className={textareaCls} placeholder="Entendimento do juízo" value={novaTese.texto} onChange={(e) => setNovaTese({ ...novaTese, texto: e.target.value })} />
              <Button disabled={novaTese.titulo.length < 3 || novaTese.texto.length < 10} onClick={() => salvar(async () => { await api.post("/gabinete/teses", { ...novaTese, ativa: true }, "PUT"); setNovaTese({ titulo: "", texto: "" }); })}>Adicionar tese</Button>
            </div>
          )}
        </Card>
      </div>

      {pode("gabinete:equipe_gerenciar") && (
        <Card title="Equipe do gabinete">
          <table className="mb-4 w-full text-left text-sm">
            <thead><tr className="text-slate-500"><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th></tr></thead>
            <tbody>{equipe.map((m) => <tr key={m.uid}><td>{m.nome}</td><td>{m.email}</td><td>{ROLE_LABEL[m.role as keyof typeof ROLE_LABEL] ?? m.role}</td><td>{m.ativo ? "ativo" : "suspenso"}</td></tr>)}</tbody>
          </table>
          <div className="grid gap-2 md:grid-cols-5">
            <input className={textareaCls} placeholder="UID do Firebase" value={membro.uid} onChange={(e) => setMembro({ ...membro, uid: e.target.value })} />
            <input className={textareaCls} placeholder="Nome" value={membro.nome} onChange={(e) => setMembro({ ...membro, nome: e.target.value })} />
            <input className={textareaCls} placeholder="E-mail" value={membro.email} onChange={(e) => setMembro({ ...membro, email: e.target.value })} />
            <select className={textareaCls} value={membro.role} onChange={(e) => setMembro({ ...membro, role: e.target.value })}>{ROLES.filter((r) => r !== "super_admin").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
            <Button disabled={!membro.uid || !membro.email} onClick={() => salvar(() => api.post(`/gabinete/equipe/${membro.uid}`, { ...membro, ativo: true }, "PUT"))}>Salvar membro</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
