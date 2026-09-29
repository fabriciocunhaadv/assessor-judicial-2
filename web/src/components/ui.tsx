import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ title, icon, actions, children, className = "", bodyClass = "p-4" }: { title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{icon}{title}</h2>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

type Variant = "primary" | "ghost" | "danger" | "dark" | "subtle";
export function Button({ loading, variant = "primary", size = "md", children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: Variant; size?: "sm" | "md" }) {
  const styles: Record<Variant, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300 dark:disabled:bg-emerald-900",
    dark: "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900",
    ghost: "border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
    subtle: "text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800",
    danger: "border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed ${sizes[size]} ${styles[variant]} ${className}`}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ErrorBox({ erro }: { erro: string | null }) {
  if (!erro) return null;
  return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{erro}</div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "ok" | "warn" }) {
  const t = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  }[tone];
  return <div className={`rounded-lg border p-3 text-sm ${t}`}>{children}</div>;
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "violet" | "sky" }) {
  const t = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    red: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    violet: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

/** Controle segmentado (ex.: tipo de minuta, PDF/Texto). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: NoInfer<T>; label: ReactNode }[]; onChange(v: NoInfer<T>): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${value === o.value ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Abas de página. */
export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: NoInfer<T>; label: ReactNode; count?: number }[]; onChange(v: NoInfer<T>): void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
      {tabs.map((t) => (
        <button key={t.value} role="tab" type="button" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${value === t.value ? "border-emerald-600 text-emerald-700 dark:text-emerald-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}{hint && <span className="font-normal normal-case tracking-normal">{hint}</span>}</span>
      {children}
    </label>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">{icon}</div>}
      <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {children && <div className="max-w-md text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
export const textareaCls = inputCls;
