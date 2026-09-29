/**
 * Motor de limpeza de PDFs forenses (Projudi, PJe, eproc).
 * Roda idêntico no navegador (PDF.js) e no servidor (pdf-parse).
 *
 * Remove: tarjas/carimbos laterais de assinatura, hashes e URLs de validação ICP-Brasil,
 * numeração de folhas/páginas, cabeçalhos e rodapés repetitivos do tribunal.
 * Preserva: texto corrido — orações quebradas na virada de página são reunidas.
 */

/** Linhas que são ruído de digitalização em qualquer tribunal. */
const NOISE_LINE_PATTERNS: RegExp[] = [
  /^documento\s+assinado\s+(digitalmente|eletronicamente)\b.*$/i,
  /^assinado\s+(digitalmente|eletronicamente)\s+por\b.*$/i,
  /^assinatura\s+eletr[oô]nica\b.*$/i,
  /\bICP[-\s]?Brasil\b/i,
  /^(este\s+documento\s+)?(pode\s+ser\s+)?(validado|verificado|conferido)\s+(em|no\s+(site|endere[cç]o))\b.*$/i,
  /^c[oó]digo\s+(de\s+)?(valida[cç][aã]o|verificador|de\s+autenticidade)\s*[:：]?.*$/i,
  /^(chave|identificador)\s+(de\s+acesso|do\s+documento)\s*[:：].*$/i,
  /^(hash|sha-?(1|256|512)|md5)\s*[:：]?\s*[0-9a-f]{16,}\s*$/i,
  /^[0-9a-f]{32,}$/i,
  /^https?:\/\/\S*(validar|autenticidade|verificador|consultadocumento|conferir|documento\.jsf|processo\/documento)\S*$/i,
  /^(p[aá]g(ina)?\.?|fl(s|ha)?\.?|folha)\s*\d+(\s*(de|\/)\s*\d+)?\s*$/i,
  /^-?\s*\d+\s*-?$/,
  /^\d+\s*(de|\/)\s*\d+$/i,
  /^evento\s+\d+\s*,?\s*[A-Z_]+\d*\s*,?\s*p[aá]gina\s+\d+\s*$/i,
  /^(num\.|n[uú]mero\s+do\s+documento)\s*[:：]?\s*\d{6,}\s*-?\s*p[aá]g\.?\s*\d+\s*$/i,
  /^(protocolo|recebido\s+em|juntado\s+em)\s*[:：]?\s*\d{1,2}\/\d{1,2}\/\d{2,4}.*\b\d{2}:\d{2}(:\d{2})?\s*$/i,
];

/** Tarjas laterais rotacionadas chegam como linhas com 1–3 caracteres por linha (texto "empilhado"). */
function isVerticalStampFragment(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && t.length <= 2 && !/^[IVX]+$/.test(t);
}

export function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return NOISE_LINE_PATTERNS.some((re) => re.test(t));
}

/** Normaliza para comparar cabeçalhos/rodapés que só diferem por números (ex.: "Pág. 3"). */
function signature(line: string): string {
  return line.trim().toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ");
}

/**
 * Detecta linhas que se repetem no topo/rodapé de muitas páginas (cabeçalho do tribunal).
 * Considera as `edge` primeiras e últimas linhas de cada página; repetição ≥ `ratio` das páginas.
 */
export function detectRepeatedEdges(pages: string[][], edge = 4, ratio = 0.4): Set<string> {
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const nonEmpty = lines.filter((l) => l.trim());
    const edges = new Set([...nonEmpty.slice(0, edge), ...nonEmpty.slice(-edge)].map(signature));
    edges.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
  }
  const min = Math.max(3, Math.ceil(pages.length * ratio));
  const out = new Set<string>();
  counts.forEach((n, s) => {
    if (n >= min && s.length >= 4) out.add(s);
  });
  return out;
}

const SENTENCE_END = /[.!?:;…"”)\]]\s*$/;

/** Reúne a última linha de uma página com a primeira da seguinte quando a oração foi quebrada. */
function joinAcrossPages(prev: string, next: string, marker = ""): string {
  const m = marker ? marker + " " : "";
  if (!prev) return m + next;
  if (!next) return prev + (marker ? " " + marker : "");
  const p = prev.replace(/\s+$/, "");
  const n = next.replace(/^\s+/, "");
  if (/[A-Za-zÀ-ú]-$/.test(p) && /^[a-zà-ú]/.test(n)) {
    return marker ? p.slice(0, -1) + n.replace(/^(\S+)/, `$1 ${marker}`) : p.slice(0, -1) + n; // hifenização
  }
  if (!SENTENCE_END.test(p) && /^[a-zà-ú0-9,(]/.test(n)) return p + " " + m + n;
  return p + "\n\n" + m + n;
}

export interface CleanOptions {
  /**
   * Insere marcadores discretos "⟦Pág. N⟧" no ponto exato da virada de página, sem quebrar
   * a oração (útil para a tríplice localização Mov./Arq./Pág.). Padrão: true.
   */
  keepPageMarkers?: boolean;
}

/**
 * Limpa um documento dado como lista de páginas (texto bruto por página).
 * Retorna texto corrido, com marcadores de página opcionais para rastreabilidade.
 */
export function cleanPages(rawPages: string[], opts: CleanOptions = {}): string {
  const keepMarkers = opts.keepPageMarkers ?? true;
  const pages = rawPages.map((p) => p.replace(/\r\n?/g, "\n").split("\n"));
  const repeated = detectRepeatedEdges(pages);

  const cleanedPages = pages.map((lines) => {
    const kept: string[] = [];
    let stampRun: string[] = [];
    const flushStamp = () => {
      if (stampRun.length < 6) kept.push(...stampRun); // sequência curta: não é tarja
      stampRun = [];
    };
    for (const line of lines) {
      if (isVerticalStampFragment(line)) {
        stampRun.push(line);
        continue;
      }
      flushStamp();
      if (isNoiseLine(line)) continue;
      if (repeated.has(signature(line))) continue;
      kept.push(line.replace(/[ \t]+/g, " ").trimEnd());
    }
    flushStamp();
    return collapseBlankLines(kept.join("\n")).trim();
  });

  let out = "";
  cleanedPages.forEach((text, i) => {
    out = joinAcrossPages(out, text, keepMarkers ? `⟦Pág. ${i + 1}⟧` : "");
  });
  return out.trim();
}

/** Versão para texto único (sem separação de páginas conhecida). */
export function cleanJudicialText(raw: string): string {
  const pages = raw.split(/\f/);
  return cleanPages(pages, { keepPageMarkers: false });
}

function collapseBlankLines(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n");
}
