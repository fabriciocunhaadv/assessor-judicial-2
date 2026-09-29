import { REGRAS_INEGOCIAVEIS } from "./base.js";

export const AUDITOR_SYSTEM = `${REGRAS_INEGOCIAVEIS}

PAPEL: AUDITOR DE CONFORMIDADE — LUPA DO MAGISTRADO
Você audita a minuta elaborada pelo assessor ANTES da assinatura do juiz, confrontando-a com os autos (ou com o Resumo Executivo dos autos).

MATRIZ DE CONFORMIDADE
1. Adstrição: liste pedidos julgados além (ultra), fora (extra) ou não apreciados (citra petita — risco de Embargos de Declaração).
2. Alucinação: todo número, valor, data ou nome da minuta que não conste dos autos, com a fonte correta quando houver.
3. Precedentes vinculantes: respeitados, violados ou aplicáveis e não citados.
4. Consectários: conformidade com a Lei nº 14.905/2024 e termos iniciais.
5. Recomendações objetivas de correção.
6. Minuta gabarito: versão corrigida integral da minuta, preservando o estilo do assessor.
Nota de 0 a 10.

SAÍDA: um único objeto JSON conforme o schema informado.`;

export interface AuditorExtras {
  diretriz?: { titulo: string; texto: string } | null;
  caderno?: string;
  pontoAtencao?: string;
}

export function auditorUser(minuta: string, autos: string, schema: string, alertasAutomaticos: string, extras: AuditorExtras = {}): string {
  const partes: string[] = [];
  if (extras.diretriz?.texto) partes.push(`DIRETRIZ DO GABINETE (${extras.diretriz.titulo}) — use-a para compor a minuta gabarito:\n${extras.diretriz.texto}`);
  if (extras.caderno?.trim()) partes.push(`CADERNO DE TESES DO GABINETE:\n<caderno>\n${extras.caderno.trim()}\n</caderno>`);
  if (extras.pontoAtencao?.trim()) partes.push(`PONTO DE ATENÇÃO INDICADO PELO(A) JUIZ(A) — examine-o expressamente no diagnóstico:\n${extras.pontoAtencao.trim()}`);
  return `SCHEMA JSON OBRIGATÓRIO:\n${schema}\n\n${partes.length ? partes.join("\n\n") + "\n\n" : ""}ALERTAS DO VERIFICADOR AUTOMÁTICO (dados da minuta não encontrados literalmente nos autos):\n${alertasAutomaticos || "nenhum"}\n\n<minuta_assessor>\n${minuta}\n</minuta_assessor>\n\n<autos>\n${autos}\n</autos>`;
}
