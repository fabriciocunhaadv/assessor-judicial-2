import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { cleanPages } from "@shared/judicialTextCleaner";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Ingestão sequencial página a página (100–400+ páginas) sem travar a interface:
 * cede o controle ao navegador a cada página e informa o progresso.
 */
export async function extrairTextoPdf(file: File, onProgress?: (pagina: number, total: number) => void): Promise<{ texto: string; paginas: number }> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const paginas: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let linha = "";
      const linhas: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        linha += item.str;
        if (item.hasEOL) {
          linhas.push(linha);
          linha = "";
        }
      }
      if (linha) linhas.push(linha);
      paginas.push(linhas.join("\n"));
      page.cleanup();
      onProgress?.(n, doc.numPages);
      if (n % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    await task.destroy();
  }
  return { texto: cleanPages(paginas), paginas: paginas.length };
}
