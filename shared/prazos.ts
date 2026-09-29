/**
 * Contagem de prazos processuais em dias úteis (CPC, arts. 219, 220 e 224).
 *
 * - Exclui o dia do começo e inclui o do vencimento (art. 224, caput).
 * - O começo e o vencimento que caírem em dia sem expediente passam para o primeiro dia útil seguinte (art. 224, § 1º).
 * - Sábados, domingos, feriados nacionais e o recesso de 20/12 a 20/01 (art. 220) não contam.
 * - Feriados locais, pontos facultativos e suspensões do tribunal são informados pelo usuário — nada é presumido.
 */

/** Feriados nacionais de data fixa (Leis 662/1949, 6.802/1980 e 14.759/2023). "MM-DD". */
export const FERIADOS_NACIONAIS_FIXOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Dia Nacional de Zumbi e da Consciência Negra",
  "12-25": "Natal",
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDias = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
export const parseData = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Data inválida: "${s}". Use AAAA-MM-DD.`);
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (iso(dt) !== s) throw new Error(`Data inexistente: "${s}".`);
  return dt;
};

/** Recesso forense (art. 220 do CPC): 20/12 a 20/01, inclusive. */
export function emRecesso(d: Date): boolean {
  const m = d.getUTCMonth() + 1, dia = d.getUTCDate();
  return (m === 12 && dia >= 20) || (m === 1 && dia <= 20);
}

export interface MotivoNaoUtil { data: string; motivo: string }

export function motivoNaoUtil(d: Date, extras: Set<string>): string | null {
  const dow = d.getUTCDay();
  if (dow === 0) return "domingo";
  if (dow === 6) return "sábado";
  const mmdd = iso(d).slice(5);
  if (FERIADOS_NACIONAIS_FIXOS[mmdd]) return `feriado nacional — ${FERIADOS_NACIONAIS_FIXOS[mmdd]}`;
  if (emRecesso(d)) return "recesso forense (art. 220 do CPC)";
  if (extras.has(iso(d))) return "sem expediente (informado)";
  return null;
}

export interface ResultadoPrazo {
  inicioContagem: string;
  vencimento: string;
  diasCorridos: number;
  ignorados: MotivoNaoUtil[];
}

/**
 * @param intimacao data da intimação/publicação (dia do começo, excluído)
 * @param dias quantidade de dias do prazo
 * @param extrasSemExpediente datas "AAAA-MM-DD" sem expediente no tribunal (feriados locais, suspensões)
 * @param uteis true = dias úteis (regra do CPC); false = dias corridos (ex.: prazos materiais)
 */
export function calcularPrazo(intimacao: string, dias: number, extrasSemExpediente: string[] = [], uteis = true): ResultadoPrazo {
  if (!Number.isInteger(dias) || dias < 1 || dias > 3650) throw new Error("Informe um prazo entre 1 e 3650 dias.");
  const extras = new Set(extrasSemExpediente.map((s) => iso(parseData(s.trim()))));
  const ignorados: MotivoNaoUtil[] = [];
  let d = parseData(intimacao);

  // Primeiro dia da contagem: dia seguinte ao começo, empurrado para o primeiro dia útil (art. 224, §§ 1º e 3º).
  d = addDias(d, 1);
  let m: string | null;
  while ((m = motivoNaoUtil(d, extras))) { ignorados.push({ data: iso(d), motivo: m }); d = addDias(d, 1); }
  const inicioContagem = iso(d);

  let contados = 1;
  while (contados < dias) {
    d = addDias(d, 1);
    const mot = uteis ? motivoNaoUtil(d, extras) : null;
    if (mot) ignorados.push({ data: iso(d), motivo: mot });
    else contados++;
  }
  // Vencimento em dia sem expediente prorroga para o primeiro dia útil seguinte (art. 224, § 1º).
  while ((m = motivoNaoUtil(d, extras))) { ignorados.push({ data: iso(d), motivo: m }); d = addDias(d, 1); }

  const diasCorridos = Math.round((d.getTime() - parseData(intimacao).getTime()) / 86_400_000);
  return { inicioContagem, vencimento: iso(d), diasCorridos, ignorados };
}
