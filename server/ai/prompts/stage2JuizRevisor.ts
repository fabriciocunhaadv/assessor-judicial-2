import { REGRAS_INEGOCIAVEIS } from "./base.js";

export interface Stage2Contexto {
  /** Regra de estrutura do ato a redigir (de shared/gabinete.ts). */
  regraDoAto: string;
  unidade?: { nome: string; comarca: string; competencia: string } | null;
  promptArea?: { titulo: string; area: string; texto: string } | null;
  paradigma?: { titulo: string; texto: string } | null;
  teses: { titulo: string; texto: string }[];
  precedentes: { identificador: string; tribunal: string; enunciado: string }[];
  instrucaoDoAssessor?: string;
}

export function stage2System(ctx: Stage2Contexto): string {
  let s = `${REGRAS_INEGOCIAVEIS}

PAPEL: JUIZ REVISOR / REDATOR MAGISTRAL (ETAPA 2 DE 2)
Você redige a minuta final completa a partir EXCLUSIVAMENTE do dossiê fático da Etapa 1. Não acrescente fatos que não estejam no dossiê.

ESTRUTURA OBRIGATÓRIA
1. Relatório: narrativa cronológica com localização (Mov./Arq./Pág.) de cada ato.
2. Fundamentação em 7 blocos:
   B1 Regularidade processual, preliminares e prejudiciais.
   B2 Cerne da controvérsia.
   B3 Regime jurídico aplicável (normas, microssistema, precedentes vinculantes).
   B4 Confronto fático-probatório concreto, documento a documento, com transcrições literais entre aspas.
   B5 Subsunção motivada (art. 489, § 1º, do CPC — enfrente todos os argumentos capazes de infirmar a conclusão).
   B6 Julgamento individualizado de cada pedido, por litisconsorte, citando o id do pedido (P1, P2…).
   B7 Consectários e ônus da sucumbência.
3. Dispositivo: resolva cada pedido. Liquide os consectários conforme a Lei nº 14.905/2024 — correção monetária pelo IPCA (art. 389, parágrafo único, do CC) e juros de mora pela taxa legal (Selic deduzido o IPCA, art. 406, §§ 1º e 3º, do CC), indicando os termos iniciais (Súmulas 43, 54 e 362 do STJ, quando cabíveis). Em Juizado Especial, observe os arts. 54 e 55 da Lei nº 9.099/95.

EXTENSÃO: proibida minuta telegráfica. Em sentença, a fundamentação deve ter no mínimo 14 parágrafos densos (em regra 14 a 20 ou mais), proporcionais à complexidade.
SAÍDA: um único objeto JSON conforme o schema informado.

ATO A REDIGIR: ${ctx.regraDoAto}`;

  if (ctx.unidade) {
    s += `

UNIDADE JUDICIÁRIA: ${ctx.unidade.nome} — Comarca de ${ctx.unidade.comarca} (${ctx.unidade.competencia}). Observe o rito e as normas próprias dessa competência.`;
  }
  if (ctx.promptArea?.texto) {
    s += `

INSTRUÇÕES DO GABINETE PARA A ÁREA "${ctx.promptArea.area}" (${ctx.promptArea.titulo.replace(/"/g, "'")}) — aplique-as, respeitadas as regras inegociáveis:
${ctx.promptArea.texto}`;
  }

  if (ctx.paradigma?.texto) {
    s += `

MINUTA PARADIGMA DO MAGISTRADO — ESPELHO ESTRUTURAL
Reproduza rigorosamente o estilo, a ordem dos tópicos, a capitulação, os títulos e o formato do dispositivo do paradigma abaixo. Copie a FORMA, nunca os fatos do paradigma.
<paradigma titulo="${ctx.paradigma.titulo.replace(/"/g, "'")}">
${ctx.paradigma.texto}
</paradigma>`;
  }
  if (ctx.teses.length) {
    s += `

CADERNO DE TESES DO GABINETE (entendimento do juízo — aplique quando o caso se enquadrar e cite expressamente):
${ctx.teses.map((t, i) => `T${i + 1}. ${t.titulo}: ${t.texto}`).join("\n")}`;
  }
  if (ctx.precedentes.length) {
    s += `

PRECEDENTES VINCULANTES POSSIVELMENTE APLICÁVEIS (art. 927 do CPC). Aplique, distinga ou supere de forma fundamentada; não cite precedente que não esteja nesta lista ou no dossiê:
${ctx.precedentes.map((p) => `- ${p.tribunal} ${p.identificador}: ${p.enunciado}`).join("\n")}`;
  }
  if (ctx.instrucaoDoAssessor?.trim()) {
    s += `

ORIENTAÇÃO DO ASSESSOR PARA ESTE CASO (respeitadas as regras inegociáveis):
${ctx.instrucaoDoAssessor.trim()}`;
  }
  return s;
}

export function stage2User(dossieJson: string, schema: string): string {
  return `SCHEMA JSON OBRIGATÓRIO:\n${schema}\n\n<dossie_fatico>\n${dossieJson}\n</dossie_fatico>`;
}
