import { Gavel, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { Permission } from "@shared/roles";
import { ComunicadoBanner, navItems, Sidebar, TopBar } from "./components/Shell";
import { Button, ErrorBox } from "./components/ui";
import { useAuth } from "./lib/auth";
import { authDisabled } from "./lib/firebase";
import { useGabinete } from "./lib/gabinete";
import Admin from "./pages/Admin";
import Audiencia from "./pages/Audiencia";
import Chat from "./pages/Chat";
import Consectarios from "./pages/Consectarios";
import Equipe from "./pages/Equipe";
import Esteira from "./pages/Esteira";
import Historico from "./pages/Historico";
import Lupa from "./pages/Lupa";
import Modelos from "./pages/Modelos";
import Precedentes from "./pages/Precedentes";
import Prompts from "./pages/Prompts";

const ROTAS: { path: string; perm: Permission; el: ReactNode }[] = [
  { path: "/", perm: "minuta:gerar", el: <Esteira /> },
  { path: "/lupa", perm: "lupa:auditar", el: <Lupa /> },
  { path: "/audiencia", perm: "audiencia:usar", el: <Audiencia /> },
  { path: "/chat", perm: "minuta:refinar", el: <Chat /> },
  { path: "/historico", perm: "minuta:gerar", el: <Historico /> },
  { path: "/modelos", perm: "minuta:gerar", el: <Modelos /> },
  { path: "/precedentes", perm: "precedentes:ler", el: <Precedentes /> },
  { path: "/prompts", perm: "minuta:gerar", el: <Prompts /> },
  { path: "/consectarios", perm: "minuta:gerar", el: <Consectarios /> },
  { path: "/equipe", perm: "gabinete:equipe_gerenciar", el: <Equipe /> },
  { path: "/admin", perm: "admin:tenants", el: <Admin /> },
];

function useTema() {
  const [escuro, setEscuro] = useState(() => {
    try { return localStorage.getItem("tema") === "escuro" || (!localStorage.getItem("tema") && matchMedia("(prefers-color-scheme: dark)").matches); } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", escuro);
    try { localStorage.setItem("tema", escuro ? "escuro" : "claro"); } catch { /* sem armazenamento */ }
  }, [escuro]);
  return [escuro, () => setEscuro((e) => !e)] as const;
}

function Login() {
  const { firebaseUser, erro, entrar, sair } = useAuth();
  return (
    <div className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 text-slate-100 lg:flex">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-600"><Gavel className="h-5 w-5" /></div><span className="text-lg font-semibold">Assessor Judicial IA</span></div>
        <div className="space-y-4">
          <p className="max-w-md text-3xl font-semibold leading-tight">Minutas fiéis aos autos, conferidas antes da assinatura.</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Duas etapas: Assessor Fático e Juiz Revisor, com Mov./Arq./Pág. em cada fato</li>
            <li>• Conferência automática de pedidos, valores, datas e números de processo</li>
            <li>• Lupa do Magistrado, Mesa de Audiência e consectários da Lei nº 14.905/2024</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">Acesso restrito a membros convidados de cada gabinete.</p>
      </div>
      <div className="grid place-items-center bg-slate-50 p-6 dark:bg-slate-900">
        <div className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="space-y-1 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Entrar no gabinete</h1>
            <p className="text-sm text-slate-500">Use o e-mail Google em que o Juiz Titular liberou seu acesso.</p>
          </div>
          {firebaseUser && <ErrorBox erro={erro} />}
          {authDisabled && <ErrorBox erro={erro ?? "API indisponível. Inicie o servidor com npm run dev."} />}
          {!authDisabled && (firebaseUser
            ? <Button variant="ghost" className="w-full" onClick={() => void sair()}>Trocar de conta</Button>
            : <Button className="w-full py-2.5" onClick={() => void entrar()}>Entrar com Google</Button>)}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { carregando, perfil, pode } = useAuth();
  const { teses, paradigmas, prompts } = useGabinete();
  const [escuro, alternarTema] = useTema();

  if (carregando) return <div className="grid h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-950">Carregando…</div>;
  if (!perfil) return <Login />;

  const itens = navItems({ teses: teses.filter((t) => t.ativa !== false).length, paradigmas: paradigmas.length, prompts: prompts.length }).filter((n) => pode(n.perm));
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar escuro={escuro} alternarTema={alternarTema} itensMobile={itens} />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar itens={itens} />
        <main className="min-w-0 flex-1 space-y-4 px-4 py-5 lg:px-6">
          <ComunicadoBanner />
          <Routes>
            {ROTAS.filter((r) => pode(r.perm)).map((r) => <Route key={r.path} path={r.path} element={r.el} />)}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
