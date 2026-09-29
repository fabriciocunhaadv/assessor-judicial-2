import { PDFParse } from "pdf-parse";
import { cleanPages } from "../../shared/judicialTextCleaner.js";

/** Extração no servidor (pdf-parse) + o mesmo motor de limpeza usado no navegador. */
export async function extrairPdf(buffer: Buffer): Promise<{ paginas: number; texto: string; caracteres: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const r = await parser.getText();
    const texto = cleanPages(r.pages.map((p) => p.text));
    return { paginas: r.pages.length, texto, caracteres: texto.length };
  } finally {
    await parser.destroy();
  }
}
