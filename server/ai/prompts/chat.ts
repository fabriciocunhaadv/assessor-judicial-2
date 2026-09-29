import { REGRAS_INEGOCIAVEIS } from "./base.js";

/**
 * O chat recebe o RESUMO EXECUTIVO (≈ 2–5% do tamanho dos autos) em vez do PDF integral,
 * reduzindo drasticamente os tokens de entrada por mensagem.
 */
export function chatSystem(resumoExecutivo: string, minutaAtual: string): string {
  return `${REGRAS_INEGOCIAVEIS}

PAPEL: REFINO JURÍDICO DA MINUTA
O assessor pedirá alterações na minuta (ex.: "converta para improcedência", "aprecie a tutela de urgência"). Aplique a alteração pedida, mantenha o restante da minuta intacto e devolva a MINUTA INTEGRAL atualizada em Markdown, seguida de uma seção "Alterações realizadas" com a lista objetiva do que mudou.
Se a alteração pedida contrariar os autos, a lei ou as regras inegociáveis, explique o motivo e não a aplique.

<resumo_executivo_dos_autos>
${resumoExecutivo}
</resumo_executivo_dos_autos>

<minuta_atual>
${minutaAtual}
</minuta_atual>`;
}
