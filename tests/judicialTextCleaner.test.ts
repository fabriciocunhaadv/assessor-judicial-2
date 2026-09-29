import { describe, expect, it } from "vitest";
import { cleanJudicialText, cleanPages, isNoiseLine } from "../shared/judicialTextCleaner";

const cabecalho = "PODER JUDICIÁRIO DO ESTADO DE GOIÁS";
const rodape = (n: number) => `Pág. ${n} de 5`;
const pagina = (n: number, corpo: string) => [cabecalho, "Comarca de Exemplo - 1ª Vara Cível", corpo, rodape(n)].join("\n");

describe("motor de limpeza de PDFs forenses", () => {
  it("remove assinaturas digitais, hashes ICP-Brasil e URLs de validação", () => {
    expect(isNoiseLine("Documento assinado eletronicamente por FULANO DE TAL, Juiz de Direito")).toBe(true);
    expect(isNoiseLine("Certificado ICP-Brasil nº 1234")).toBe(true);
    expect(isNoiseLine("3f9a0c1b2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a")).toBe(true);
    expect(isNoiseLine("https://projudi.tjgo.jus.br/validarDocumento?codigo=abc")).toBe(true);
    expect(isNoiseLine("fls. 12")).toBe(true);
    expect(isNoiseLine("O autor requer indenização de R$ 10.000,00.")).toBe(false);
  });

  it("remove cabeçalhos e rodapés repetidos em várias páginas", () => {
    const corpos = ["Trata-se de ação indenizatória.", "A ré contestou o feito.", "Houve réplica tempestiva.", "Realizada audiência de instrução.", "Vieram os autos conclusos."];
    const pages = corpos.map((c, i) => pagina(i + 1, c));
    const out = cleanPages(pages, { keepPageMarkers: false });
    expect(out).not.toContain(cabecalho);
    expect(out).not.toContain("Pág. 3 de 5");
    expect(out).toContain("Houve réplica tempestiva.");
  });

  it("funde oração quebrada na virada de página e marca a página sem quebrar a frase", () => {
    const out = cleanPages(["A parte autora alega que o contrato foi", "celebrado mediante fraude."]);
    expect(out).toBe("⟦Pág. 1⟧ A parte autora alega que o contrato foi ⟦Pág. 2⟧ celebrado mediante fraude.");
    expect(cleanPages(["indeni-", "zação devida."], { keepPageMarkers: false })).toBe("indenização devida.");
  });

  it("descarta tarja lateral rotacionada (letras empilhadas) e preserva o texto", () => {
    const tarja = "D\no\nc\nu\nm\ne\nn\nt\no".split("\n");
    const out = cleanJudicialText(["Texto do despacho.", ...tarja].join("\n"));
    expect(out).toBe("Texto do despacho.");
  });

  it("preserva linhas curtas legítimas (numeração romana de tópicos)", () => {
    expect(cleanJudicialText("I\nDOS FATOS")).toContain("I\nDOS FATOS");
  });
});
