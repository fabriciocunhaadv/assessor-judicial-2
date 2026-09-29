/**
 * Consectários legais conforme a Lei nº 14.905/2024 (arts. 389, parágrafo único, e 406 do Código Civil).
 *
 * - Correção monetária: IPCA (art. 389, parágrafo único), salvo índice convencionado ou legal específico.
 * - Juros de mora: "taxa legal" = Selic − IPCA (art. 406, § 1º); se o resultado for negativo,
 *   considera-se zero no período (art. 406, § 3º).
 *
 * O cálculo é DETERMINÍSTICO e feito pelo código — a IA apenas cita os parâmetros no dispositivo.
 * As séries mensais (IPCA e Selic) são informadas pelo usuário/serviço de índices, em % ao mês.
 */

export interface SerieMensal {
  /** "AAAA-MM" */
  competencia: string;
  /** Percentual no mês. Ex.: 0.44 para 0,44%. */
  percentual: number;
}

export interface EntradaConsectarios {
  principal: number;
  /** Termo inicial da correção (ex.: data do efetivo prejuízo — Súmula 43/STJ). "AAAA-MM" */
  inicioCorrecao: string;
  /** Termo inicial dos juros (citação, evento danoso — Súmula 54/STJ —, arbitramento etc.). "AAAA-MM" */
  inicioJuros: string;
  /** Competência final do cálculo. "AAAA-MM" */
  fim: string;
  ipca: SerieMensal[];
  selic: SerieMensal[];
}

export interface LinhaMemoria {
  competencia: string;
  ipca: number;
  selic: number;
  taxaLegal: number;
  fatorCorrecao: number;
  jurosAcumuladosPct: number;
}

export interface ResultadoConsectarios {
  principal: number;
  valorCorrigido: number;
  juros: number;
  total: number;
  memoria: LinhaMemoria[];
  fundamentacao: string;
}

function competencias(inicio: string, fim: string): string[] {
  const [ay, am] = inicio.split("-").map(Number);
  const [by, bm] = fim.split("-").map(Number);
  const out: string[] = [];
  let y = ay, m = am;
  while (y < by || (y === by && m <= bm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Taxa legal do mês = Selic − IPCA, com piso zero (art. 406, § 3º, CC). */
export function taxaLegalMensal(selicPct: number, ipcaPct: number): number {
  return Math.max(0, selicPct - ipcaPct);
}

export function calcularConsectarios(e: EntradaConsectarios): ResultadoConsectarios {
  if (e.principal < 0) throw new Error("Principal não pode ser negativo.");
  const ipca = new Map(e.ipca.map((s) => [s.competencia, s.percentual]));
  const selic = new Map(e.selic.map((s) => [s.competencia, s.percentual]));
  const primeiro = e.inicioCorrecao < e.inicioJuros ? e.inicioCorrecao : e.inicioJuros;

  let fator = 1;
  let jurosPct = 0; // juros simples, somados mês a mês
  const memoria: LinhaMemoria[] = [];

  for (const c of competencias(primeiro, e.fim)) {
    const i = ipca.get(c);
    const s = selic.get(c);
    if (i === undefined || s === undefined) {
      throw new Error(`Índice ausente para a competência ${c} (IPCA ou Selic). Cálculo interrompido — nenhum valor é estimado.`);
    }
    if (c >= e.inicioCorrecao) fator *= 1 + i / 100;
    const tl = c >= e.inicioJuros ? taxaLegalMensal(s, i) : 0;
    jurosPct += tl;
    memoria.push({ competencia: c, ipca: i, selic: s, taxaLegal: round2(tl * 1e4) / 1e4, fatorCorrecao: fator, jurosAcumuladosPct: jurosPct });
  }

  const valorCorrigido = round2(e.principal * fator);
  const juros = round2(valorCorrigido * (jurosPct / 100));
  return {
    principal: e.principal,
    valorCorrigido,
    juros,
    total: round2(valorCorrigido + juros),
    memoria,
    fundamentacao:
      "Correção monetária pelo IPCA (art. 389, parágrafo único, do CC, na redação da Lei nº 14.905/2024) " +
      `desde ${e.inicioCorrecao}, e juros de mora pela taxa legal (Selic deduzido o IPCA, art. 406, §§ 1º e 3º, do CC) ` +
      `desde ${e.inicioJuros}, considerada zero nos meses em que o resultado for negativo.`,
  };
}
