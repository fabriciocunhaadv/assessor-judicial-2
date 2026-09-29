import type { OpcoesDocx } from "@shared/minutaDocx";

/** Gera e baixa a minuta em .docx. A biblioteca é carregada só quando usada (não pesa na abertura do sistema). */
export async function baixarWord(minuta: string, nomeArquivo: string, opcoes: OpcoesDocx = {}) {
  const [{ Packer }, { minutaParaDocx }] = await Promise.all([import("docx"), import("@shared/minutaDocx")]);
  const blob = await Packer.toBlob(minutaParaDocx(minuta, opcoes));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_") + ".docx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
