import { REGRAS_INEGOCIAVEIS } from "./base.js";

/**
 * O chat recebe o RESUMO EXECUTIVO (≈ 2–5% do tamanho dos autos) em vez do PDF integral, como
 * documento com cache de 1 h: a partir da 2ª mensagem ele custa ~10% do preço de entrada.
 * O system é fixo (prefixo de cache); a minuta atual vai na última mensagem, pois muda a cada rodada.
 */
export const CHAT_SYSTEM = `${REGRAS_INEGOCIAVEIS}

PAPEL: REFINO JURÍDICO DA MINUTA
O assessor pedirá alterações na minuta (ex.: "converta para improcedência", "aprecie a tutela de urgência"). Aplique a alteração pedida, mantenha o restante da minuta intacto e devolva a MINUTA INTEGRAL atualizada em Markdown, seguida de uma seção "Alterações realizadas" com a lista objetiva do que mudou.
Se a alteração pedida contrariar os autos, a lei ou as regras inegociáveis, explique o motivo e não a aplique.`;

export function chatUser(minutaAtual: string, mensagem: string): string {
  return `<minuta_atual>\n${minutaAtual}\n</minuta_atual>\n\n${mensagem}`;
}
