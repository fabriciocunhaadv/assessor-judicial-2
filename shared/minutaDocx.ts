/**
 * Minuta (Markdown do sistema) → documento Word (.docx) no padrão forense:
 * Times New Roman 12, espaçamento 1,5, parágrafos justificados com recuo de 2 cm,
 * citações recuadas 4 cm, títulos de seção centralizados em caixa alta.
 * Funciona no navegador e no Node (a biblioteca docx não depende do DOM).
 */
import { AlignmentType, Document, Footer, Header, PageNumber, Paragraph, TextRun } from "docx";

const CM = 567; // twips por centímetro
const FONTE = "Times New Roman";

interface Trecho { texto: string; negrito?: boolean; italico?: boolean; sublinhado?: boolean }

/** Quebra **negrito**, *itálico* e __sublinhado__ em trechos. Remove marcadores internos ⟦Pág. N⟧ e [P#]. */
export function trechosInline(linha: string): Trecho[] {
  const limpa = linha.replace(/\s?⟦Pág\. \d+⟧/g, "").replace(/\s?\[P\d+\]/g, "");
  const out: Trecho[] = [];
  for (const p of limpa.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*)/g)) {
    if (!p) continue;
    if (/^\*\*.+\*\*$/.test(p)) out.push({ texto: p.slice(2, -2), negrito: true });
    else if (/^__.+__$/.test(p)) out.push({ texto: p.slice(2, -2), sublinhado: true });
    else if (/^\*.+\*$/.test(p)) out.push({ texto: p.slice(1, -1), italico: true });
    else out.push({ texto: p });
  }
  return out;
}

const runs = (t: Trecho[], extra: Partial<Trecho> = {}) =>
  t.map((x) => new TextRun({ text: x.texto, bold: x.negrito || extra.negrito, italics: x.italico || extra.italico, underline: x.sublinhado ? {} : undefined, font: FONTE, size: 24 }));

export type Bloco =
  | { tipo: "titulo"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "citacao"; texto: string }
  | { tipo: "lista"; itens: string[] };

/** Estrutura o Markdown em blocos (testável sem gerar o arquivo). */
export function blocosDaMinuta(md: string): Bloco[] {
  const out: Bloco[] = [];
  for (const bruto of md.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const t = bruto.trim();
    if (!t) continue;
    const linhas = t.split("\n");
    const h = /^(#{1,3})\s+(.*)$/.exec(linhas[0]);
    if (h) {
      out.push({ tipo: "titulo", nivel: h[1].length as 1 | 2 | 3, texto: h[2].trim() });
      if (linhas.length > 1) out.push(...blocosDaMinuta(linhas.slice(1).join("\n")));
      continue;
    }
    if (linhas.every((l) => /^\s*[-*•]\s+/.test(l))) { out.push({ tipo: "lista", itens: linhas.map((l) => l.replace(/^\s*[-*•]\s+/, "")) }); continue; }
    if (linhas.every((l) => /^\s*>/.test(l))) { out.push({ tipo: "citacao", texto: linhas.map((l) => l.replace(/^\s*>\s?/, "")).join(" ") }); continue; }
    out.push({ tipo: "paragrafo", texto: linhas.join(" ") });
  }
  return out;
}

export interface OpcoesDocx {
  /** Linha(s) do cabeçalho, ex.: "Poder Judiciário do Estado de Goiás — Juizado Especial Cível de ...". */
  cabecalho?: string;
  /** Identificação do processo no topo do documento. */
  processo?: string;
  /** Local e data + assinatura ao final (ex.: "Local, data.\n\nJuiz(a) de Direito"). */
  fecho?: string;
}

export function minutaParaDocx(md: string, op: OpcoesDocx = {}): Document {
  const paragrafos: Paragraph[] = [];
  const esp = { line: 360, after: 120 }; // 1,5 linha
  if (op.processo) paragrafos.push(new Paragraph({ children: runs([{ texto: op.processo, negrito: true }]), spacing: { after: 240 } }));

  for (const b of blocosDaMinuta(md)) {
    if (b.tipo === "titulo") {
      const centro = b.nivel <= 2;
      paragrafos.push(new Paragraph({
        children: runs(trechosInline(centro ? b.texto.toUpperCase() : b.texto), { negrito: true }),
        alignment: centro ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 240, after: 120, line: 360 },
        keepNext: true,
      }));
    } else if (b.tipo === "citacao") {
      paragrafos.push(new Paragraph({ children: runs(trechosInline(b.texto)).map((r) => r), alignment: AlignmentType.JUSTIFIED, indent: { left: 4 * CM }, spacing: { line: 240, after: 200 } }));
    } else if (b.tipo === "lista") {
      for (const it of b.itens) paragrafos.push(new Paragraph({ children: [new TextRun({ text: "• ", font: FONTE, size: 24 }), ...runs(trechosInline(it))], alignment: AlignmentType.JUSTIFIED, indent: { left: 2 * CM, hanging: 0.5 * CM }, spacing: esp }));
    } else {
      paragrafos.push(new Paragraph({ children: runs(trechosInline(b.texto)), alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 2 * CM }, spacing: esp }));
    }
  }
  if (op.fecho) for (const l of op.fecho.split("\n")) paragrafos.push(new Paragraph({ children: runs([{ texto: l }]), alignment: AlignmentType.CENTER, spacing: { line: 360 } }));

  return new Document({
    creator: "Assessor Judicial IA",
    title: op.processo ?? "Minuta",
    styles: { default: { document: { run: { font: FONTE, size: 24 } } } },
    sections: [{
      properties: { page: { margin: { top: 3 * CM, bottom: 2 * CM, left: 3 * CM, right: 2 * CM } } },
      headers: op.cabecalho ? { default: new Header({ children: op.cabecalho.split("\n").map((l) => new Paragraph({ children: [new TextRun({ text: l, font: FONTE, size: 20, bold: true })], alignment: AlignmentType.CENTER })) }) } : undefined,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 18 })] })] }) },
      children: paragrafos,
    }],
  });
}
