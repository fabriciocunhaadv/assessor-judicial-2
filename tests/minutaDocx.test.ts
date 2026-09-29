import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { blocosDaMinuta, minutaParaDocx, trechosInline } from "../shared/minutaDocx";

const md = "## RELATÓRIO\n\nTrata-se de ação ⟦Pág. 3⟧ proposta por **MARIA** [P1].\n\n## FUNDAMENTAÇÃO\n\n### 1. Regularidade\n\n> \"contrato jamais assinado\"\n\n- item um\n- item dois\n\n## DISPOSITIVO\n\nJulgo *procedente*.";

describe("exportação da minuta para Word", () => {
  it("estrutura títulos, parágrafos, citações e listas", () => {
    const b = blocosDaMinuta(md);
    expect(b.map((x) => x.tipo)).toEqual(["titulo", "paragrafo", "titulo", "titulo", "citacao", "lista", "titulo", "paragrafo"]);
  });

  it("remove marcadores internos e preserva negrito/itálico", () => {
    const t = trechosInline("proposta por **MARIA** ⟦Pág. 3⟧ [P1] em *juízo*");
    expect(t.map((x) => x.texto).join("")).toBe("proposta por MARIA em juízo");
    expect(t.find((x) => x.texto === "MARIA")?.negrito).toBe(true);
    expect(t.find((x) => x.texto === "juízo")?.italico).toBe(true);
  });

  it("gera um .docx válido com o texto da minuta", async () => {
    const buf = await Packer.toBuffer(minutaParaDocx(md, { processo: "Processo nº 0000001-00.2025.8.09.0000", cabecalho: "PODER JUDICIÁRIO" }));
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("RELATÓRIO");
    expect(xml).toContain("MARIA");
    expect(xml).not.toContain("⟦Pág.");
    expect(xml).not.toContain("[P1]");
  });
});
