import {
  BookOpen, Building2, Calculator, CalendarDays, ClipboardList, LifeBuoy, ChevronDown, FileText, Gavel, History, LogOut, Megaphone, MessageSquare, Moon, Scale, ScanSearch,
  Settings, Shield, Sparkles, Sun, Users, X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ROLE_LABEL, type Permission } from "@shared/roles";
import { useAuth } from "../lib/auth";
import { authDisabled } from "../lib/firebase";
import { useGabinete } from "../lib/gabinete";

export interface NavItem { to: string; label: string; icon: ReactNode; perm: Permission; grupo: "acoes" | "repositorio"; badge?: number }

export function navItems(counts: { teses: number; paradigmas: number; prompts: number }): NavItem[] {
  return [
    { to: "/", label: "Nova Análise", icon: <FileText className="h-4 w-4" />, perm: "minuta:gerar", grupo: "acoes" },
    { to: "/lupa", label: "Auditoria Ouro (Lupa)", icon: <ScanSearch className="h-4 w-4" />, perm: "lupa:auditar", grupo: "acoes" },
    { to: "/audiencia", label: "Mesa de Audiência", icon: <Gavel className="h-4 w-4" />, perm: "audiencia:usar", grupo: "acoes" },
    { to: "/chat", label: "Chat & Refino", icon: <MessageSquare className="h-4 w-4" />, perm: "minuta:refinar", grupo: "acoes" },
    { to: "/historico", label: "Histórico", icon: <History className="h-4 w-4" />, perm: "minuta:gerar", grupo: "acoes" },
    { to: "/agenda", label: "Agenda", icon: <CalendarDays className="h-4 w-4" />, perm: "minuta:gerar", grupo: "acoes" },
    { to: "/modelos", label: "Teses & Modelos", icon: <Scale className="h-4 w-4" />, perm: "minuta:gerar", grupo: "repositorio", badge: counts.teses + counts.paradigmas },
    { to: "/precedentes", label: "Súmulas & Precedentes", icon: <BookOpen className="h-4 w-4" />, perm: "precedentes:ler", grupo: "repositorio" },
    { to: "/prompts", label: "Prompts por Área", icon: <Sparkles className="h-4 w-4" />, perm: "minuta:gerar", grupo: "repositorio", badge: counts.prompts },
    { to: "/consectarios", label: "Legislação & Juros", icon: <Calculator className="h-4 w-4" />, perm: "minuta:gerar", grupo: "repositorio" },
    { to: "/projudi", label: "Guia do PROJUDI", icon: <ClipboardList className="h-4 w-4" />, perm: "minuta:gerar", grupo: "repositorio" },
  ];
}

export function Sidebar({ itens }: { itens: NavItem[] }) {
  const grupo = (g: NavItem["grupo"], titulo: string) => (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{titulo}</p>
      {itens.filter((n) => n.grupo === g).map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"}
          className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${isActive ? "bg-clay-50 font-semibold text-clay-800 ring-1 ring-clay-200 dark:bg-clay-950 dark:text-clay-200 dark:ring-clay-900" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"}`}>
          {n.icon}<span className="flex-1 truncate">{n.label}</span>
          {!!n.badge && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{n.badge}</span>}
        </NavLink>
      ))}
    </div>
  );
  return (
    <aside className="hidden w-64 shrink-0 border-r border-stone-200 bg-white px-3 py-5 lg:block dark:border-stone-800 dark:bg-stone-900">
      <nav className="sticky top-20 space-y-6">
        {grupo("acoes", "Ações principais")}
        {grupo("repositorio", "Repositório jurídico")}
      </nav>
    </aside>
  );
}

function useClickFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fechar(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [aberto, fechar]);
  return ref;
}

export function TopBar({ escuro, alternarTema, itensMobile }: { escuro: boolean; alternarTema(): void; itensMobile: NavItem[] }) {
  const { perfil, sair, pode } = useAuth();
  const { unidades, unidadeId, setUnidadeId, prompts, promptId } = useGabinete();
  const [menu, setMenu] = useState(false);
  const ref = useClickFora(menu, () => setMenu(false));
  const navigate = useNavigate();
  const prompt = prompts.find((p) => p.id === promptId);
  if (!perfil) return null;

  const ir = (to: string) => { setMenu(false); navigate(to); };
  const itemMenu = (to: string, icon: ReactNode, label: string, tag?: ReactNode) => (
    <button type="button" role="menuitem" onClick={() => ir(to)} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-stone-200 hover:bg-stone-800">
      {icon}<span className="flex-1">{label}</span>{tag}
    </button>
  );

  return (
    <header className="sticky top-0 z-30 bg-stone-950 text-stone-100 shadow">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-clay-600"><Gavel className="h-5 w-5 text-white" /></div>
          <div className="leading-tight">
            <p className="flex items-center gap-2 font-semibold">Assessor Judicial <span className="rounded bg-clay-500/25 px-1.5 text-[10px] font-bold text-clay-200">com Claude</span></p>
            <p className="text-[11px] text-stone-400">{perfil.gabineteNome}</p>
          </div>
        </div>

        {unidades.length > 0 && (
          <label className="flex items-center gap-2 rounded-lg bg-stone-900 px-2.5 py-1.5 ring-1 ring-stone-800">
            <Building2 className="h-4 w-4 text-clay-400" />
            <span className="sr-only">Unidade judiciária ativa</span>
            <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="max-w-[16rem] bg-transparent text-xs font-medium text-stone-100 outline-none">
              {unidades.map((u) => <option key={u.id} value={u.id} className="text-stone-900">{u.nome} — {u.comarca}</option>)}
            </select>
          </label>
        )}

        <button type="button" onClick={() => navigate("/")} className="hidden max-w-xs items-center gap-2 truncate rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs ring-1 ring-stone-800 md:flex" title="Prompt ativo">
          <Sparkles className="h-3.5 w-3.5 text-clay-400" /><span className="text-stone-400">Prompt ativo:</span><span className="truncate font-medium">{prompt ? prompt.titulo : "Padrão do sistema"}</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs ring-1 ring-stone-800 sm:flex">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-stone-700 text-[11px] font-bold">{perfil.nome.slice(0, 1).toUpperCase()}</span>
            <span className="max-w-[10rem] truncate">{perfil.nome}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${perfil.role === "super_admin" ? "bg-violet-500/20 text-violet-200" : perfil.role === "juiz_titular" ? "bg-amber-500/20 text-amber-200" : "bg-stone-700 text-stone-200"}`}>{ROLE_LABEL[perfil.role]}</span>
          </span>
          <div className="relative" ref={ref}>
            <button type="button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium ring-1 ring-stone-800 hover:bg-stone-800">
              <Settings className="h-4 w-4" /> Configurações <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl bg-stone-900 p-1.5 shadow-xl ring-1 ring-stone-700">
                {pode("admin:tenants") && itemMenu("/admin", <Shield className="h-4 w-4 text-violet-300" />, "Super Admin", <span className="rounded bg-violet-500/20 px-1.5 text-[10px] font-bold text-violet-200">SAAS</span>)}
                {pode("gabinete:equipe_gerenciar") && itemMenu("/equipe", <Users className="h-4 w-4" />, "Equipe, lotações e avisos")}
                {itemMenu("/prompts", <Sparkles className="h-4 w-4" />, "Prompts por área")}
                {itemMenu("/modelos", <Scale className="h-4 w-4" />, "Teses & Modelos")}
                {itemMenu("/ajuda", <LifeBuoy className="h-4 w-4" />, "Manual de uso")}
                <div className="my-1 border-t border-stone-800" />
                <button type="button" role="menuitem" onClick={() => { alternarTema(); setMenu(false); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-stone-200 hover:bg-stone-800">
                  {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Tema {escuro ? "claro" : "escuro"}
                </button>
                {!authDisabled && (
                  <button type="button" role="menuitem" onClick={() => void sair()} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-rose-300 hover:bg-stone-800">
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-stone-800 px-3 py-2 lg:hidden" aria-label="Navegação">
        {itensMobile.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${isActive ? "bg-clay-600 text-white" : "text-stone-300 hover:bg-stone-800"}`}>{n.icon}{n.label}</NavLink>
        ))}
      </nav>
    </header>
  );
}

/** Comunicado global (Super Admin) e aviso do gabinete. Fechar vale até o texto mudar. */
export function ComunicadoBanner() {
  const { comunicados } = useGabinete();
  const [fechados, setFechados] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("assessor.avisosFechados") ?? "[]"); } catch { return []; } });
  const itens = [comunicados.global && { ...comunicados.global, origem: "Comunicado geral" }, comunicados.gabinete && { ...comunicados.gabinete, origem: "Aviso do gabinete" }]
    .filter((c): c is NonNullable<typeof c> => !!c && !fechados.includes(c.texto));
  if (!itens.length) return null;
  const fechar = (t: string) => { const n = [...fechados, t].slice(-20); setFechados(n); try { localStorage.setItem("assessor.avisosFechados", JSON.stringify(n)); } catch { /* */ } };
  return (
    <div className="space-y-2">
      {itens.map((c) => (
        <div key={c.origem} className={`flex items-start gap-3 rounded-lg border px-4 py-2.5 text-sm ${c.nivel === "alerta" ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"}`}>
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1"><strong>{c.origem}:</strong> {c.texto}</p>
          <button type="button" aria-label="Fechar aviso" onClick={() => fechar(c.texto)} className="rounded p-0.5 hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}
