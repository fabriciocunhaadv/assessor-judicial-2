/** Vocabulário do gabinete compartilhado entre interface e servidor. */

export const TIPOS_ATO = ["auto", "sentenca", "decisao", "despacho", "embargos"] as const;
export type TipoAto = (typeof TIPOS_ATO)[number];

export const TIPO_ATO_LABEL: Record<TipoAto, string> = {
  auto: "Auto-detectar",
  sentenca: "Sentença",
  decisao: "Decisão",
  despacho: "Despacho",
  embargos: "Embargos",
};

/** Instrução de estrutura por ato. A fundamentação longa só é exigida em sentença. */
export const REGRA_POR_ATO: Record<Exclude<TipoAto, "auto">, string> = {
  sentenca:
    "SENTENÇA completa: relatório, fundamentação nos 7 blocos (mínimo de 14 parágrafos densos) e dispositivo que resolve cada pedido.",
  decisao:
    "DECISÃO INTERLOCUTÓRIA (ex.: tutela de urgência, saneamento do art. 357 do CPC): relatório breve, fundamentação objetiva nos blocos pertinentes (deixe vazios os que não se aplicam) e dispositivo com as providências.",
  despacho:
    "DESPACHO de mero expediente: sem relatório extenso e sem fundamentação em blocos (deixe os blocos vazios); dispositivo com as determinações numeradas e prazos.",
  embargos:
    "DECISÃO EM EMBARGOS DE DECLARAÇÃO: relatório dos vícios apontados (omissão, contradição, obscuridade, erro material — art. 1.022 do CPC), enfrentamento de cada vício e dispositivo (conhecer e acolher/rejeitar).",
};

export const exigePisoDeParagrafos = (ato: string) => ato === "sentenca";

export const AREAS = [
  "Juizado Especial Cível",
  "Cível",
  "Fazenda Pública",
  "Juizado da Fazenda Pública",
  "Família e Sucessões",
  "Previdenciário",
  "Criminal",
  "Outros",
] as const;
export type Area = (typeof AREAS)[number];
