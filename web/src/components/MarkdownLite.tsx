import type { ReactNode } from "react";

/** Renderizador mínimo e seguro (sem HTML bruto): títulos, parágrafos, listas, **negrito**, *itálico* e __sublinhado__. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("__") && p.endsWith("__")) return <u key={i}>{p.slice(2, -2)}</u>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

export function MarkdownLite({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="minuta text-stone-900 dark:text-stone-100">
      {blocks.map((b, i) => {
        const t = b.trim();
        if (/^#{1,3}\s/.test(t)) return <h2 key={i}>{inline(t.replace(/^#{1,3}\s/, ""))}</h2>;
        if (/^[-*]\s/m.test(t) && t.split("\n").every((l) => /^[-*]\s/.test(l.trim())))
          return <ul key={i} className="mb-3 list-disc pl-6">{t.split("\n").map((l, j) => <li key={j}>{inline(l.trim().slice(2))}</li>)}</ul>;
        return <p key={i}>{t.split("\n").flatMap((l, j) => (j ? [<br key={`b${j}`} />, ...inline(l)] : inline(l)))}</p>;
      })}
    </div>
  );
}
