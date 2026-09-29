import { BookOpen, Building2, FileText, Gavel, LogOut, MessageSquare, Moon, ScanSearch, Shield, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ROLE_LABEL, type Permission } from "@shared/roles";
import { Button, ErrorBox } from "./components/ui";
import { useAuth } from "./lib/auth";
import { authDisabled } from "./lib/firebase";
import Admin from "./pages/Admin";
import Audiencia from "./pages/Audiencia";
import Chat from "./pages/Chat";
import Esteira from "./pages/Esteira";
import Gabinete from "./pages/Gabinete";
import Lupa from "./pages/Lupa";
import Precedentes from "./pages/Precedentes";

const NAV: { to: string; label: string; icon: ReactNode; perm: Permission; el: ReactNode }[] = [
  { to: "/", label: "Esteira de Minutas", icon: <FileText className="h-4 w-4" />, perm: "minuta:gerar", el: <Esteira /> },
  { to: "/lupa", label: "Lupa do Magistrado", icon: <ScanSearch className="h-4 w-4" />, perm: "lupa:auditar", el: <Lupa /> },
  { to: "/audiencia", label: "Mesa de Audiência", icon: <Gavel className="h-4 w-4" />, perm: "audiencia:usar", el: <Audiencia /> },
  { to: "/chat", label: "Chat & Refino", icon: <MessageSquare className="h-4 w-4" />, perm: "minuta:refinar", el: <Chat /> },
  { to: "/precedentes", label: "Precedentes", icon: <BookOpen className="h-4 w-4" />, perm: "precedentes:ler", el: <Precedentes /> },
  { to: "/gabinete", label: "Gabinete", icon: <Building2 className="h-4 w-4" />, perm: "minuta:gerar", el: <Gabinete /> },
  { to: "/admin", label: "Super Admin", icon: <Shield className="h-4 w-4" />, perm: "admin:custos", el: <Admin /> },
];

function useTema() {
  const [escuro, setEscuro] = useState(() => {
    try { return localStorage.getItem("tema") === "escuro" || (!localStorage.getItem("tema") && matchMedia("(prefers-color-scheme: dark)").matches); } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", escuro);
    try { localStorage.setItem("tema", escuro ? "escuro" : "claro"); } catch { /* sem armazenamento */ }
  }, [escuro]);
  return [escuro, setEscuro] as const;
}

export default function App() {
  const { carregando, perfil, firebaseUser, erro, entrar, sair, pode } = useAuth();
  const [escuro, setEscuro] = useTema();

  if (carregando) return <div className="grid h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-950">Carregando…</div>;

  if (!perfil) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <Gavel className="mx-auto h-10 w-10 text-indigo-600" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Assessor Judicial IA</h1>
          <p className="text-sm text-slate-500">Acesso restrito a membros cadastrados do gabinete.</p>
          {firebaseUser && <ErrorBox erro={erro} />}
          {!authDisabled && (firebaseUser ? <Button variant="ghost" onClick={sair} className="w-full">Trocar de conta</Button> : <Button onClick={entrar} className="w-full">Entrar com Google</Button>)}
          {authDisabled && <ErrorBox erro={erro ?? "API indisponível. Inicie o servidor com npm run dev."} />}
        </div>
      </div>
    );
  }

  const itens = NAV.filter((n) => pode(n.perm));
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2 px-2 font-semibold"><Gavel className="h-5 w-5 text-indigo-600" /> Assessor Judicial IA</div>
        <nav className="flex-1 space-y-1">
          {itens.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
              {n.icon} {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
          <p className="truncate font-medium">{perfil.nome}</p>
          <p className="text-slate-500">{ROLE_LABEL[perfil.role]} · {perfil.tenantId}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEscuro(!escuro)} aria-label="Alternar tema">{escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            {!authDisabled && <Button variant="ghost" onClick={sair}><LogOut className="h-4 w-4" /> Sair</Button>}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4">
        <nav className="mb-4 flex gap-1 overflow-x-auto md:hidden">
          {itens.map((n) => <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs ${isActive ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900"}`}>{n.icon}{n.label}</NavLink>)}
        </nav>
        <Routes>
          {itens.map((n) => <Route key={n.to} path={n.to} element={n.el} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
