import { FileUp } from "lucide-react";
import { useState } from "react";
import { extrairTextoPdf } from "../lib/pdf";
import { useCaso } from "../lib/caso";
import { ErrorBox } from "./ui";

export function PdfUpload() {
  const { caso, atualizar } = useCaso();
  const [progresso, setProgresso] = useState<{ p: number; t: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function onFile(file?: File) {
    if (!file) return;
    setErro(null);
    try {
      const { texto, paginas } = await extrairTextoPdf(file, (p, t) => setProgresso({ p, t }));
      if (texto.replace(/⟦Pág\. \d+⟧/g, "").trim().length < 200) {
        setErro("O PDF parece ser digitalizado sem camada de texto (imagem). Aplique OCR antes de enviar.");
      }
      if (caso.pdfUrl) URL.revokeObjectURL(caso.pdfUrl);
      atualizar({ nomeArquivo: file.name, pdfUrl: URL.createObjectURL(file), autos: texto, paginas, minuta: "", resumoExecutivo: "" });
    } catch (e) {
      setErro(`Falha ao ler o PDF: ${(e as Error).message}`);
    } finally {
      setProgresso(null);
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 hover:border-indigo-400 dark:border-slate-700 dark:text-slate-300">
        <FileUp className="h-6 w-6" />
        {progresso ? (
          <span>Lendo página {progresso.p} de {progresso.t}…</span>
        ) : caso.nomeArquivo ? (
          <span><strong>{caso.nomeArquivo}</strong> — {caso.paginas} páginas, {caso.autos.length.toLocaleString("pt-BR")} caracteres após limpeza. Clique para trocar.</span>
        ) : (
          <span>Selecione os autos em PDF (Projudi, PJe, eproc)</span>
        )}
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {progresso && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(progresso.p / progresso.t) * 100}%` }} />
        </div>
      )}
      <ErrorBox erro={erro} />
    </div>
  );
}
