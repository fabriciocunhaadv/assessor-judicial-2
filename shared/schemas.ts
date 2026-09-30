/**
 * Contratos JSON trocados entre as etapas da esteira e com o frontend.
 * Validados com zod no servidor — resposta de IA fora do contrato é rejeitada e reprocessada.
 */
import { z } from "zod";

/** Tríplice localização obrigatória: Movimentação, Arquivo e Página. */
export const Localizacao = z.object({
  mov: z.string().describe("Número da movimentação/evento. Ex.: '32'. Use 'n/i' se não identificável."),
  arq: z.string().describe("Arquivo/documento dentro da movimentação. Ex.: '2 - Contestação'."),
  pag: z.string().describe("Página no PDF consolidado. Ex.: '47'."),
});
export type Localizacao = z.infer<typeof Localizacao>;

export const TipoPeca = z.enum([
  "peticao_inicial",
  "emenda",
  "decisao",
  "citacao",
  "contestacao",
  "reconvencao",
  "replica",
  "audiencia",
  "laudo",
  "peticao_intercorrente",
  "manifestacao_mp",
  "sentenca",
  "embargos",
  "certidao",
  "outro",
]);

export const EventoCronologia = z.object({
  data: z.string().describe("Data exatamente como consta nos autos (dd/mm/aaaa) ou 'n/i'."),
  tipo: TipoPeca,
  resumo: z.string().describe("Síntese fiel, sem inferências, do conteúdo da peça."),
  transcricoes: z.array(z.string()).describe("Trechos literais relevantes, entre aspas no original."),
  local: Localizacao,
});

export const Pedido = z.object({
  id: z.string().describe("Identificador estável. Ex.: 'P1', 'P2'."),
  litisconsorte: z.string().describe("Nome exato da parte que formulou o pedido. Nunca fundir litisconsortes."),
  descricao: z.string(),
  valor: z.string().nullable().describe("Valor EXATAMENTE como consta nos autos (ex.: 'R$ 12.345,67') ou null."),
  natureza: z.enum(["principal", "subsidiario", "cumulativo", "tutela_urgencia", "acessorio"]),
  local: Localizacao,
});

export const Prova = z.object({
  descricao: z.string(),
  produzidaPor: z.string(),
  local: Localizacao,
});

/** Saída da Etapa 1 — Assessor Fático. */
export const DossieFatico = z.object({
  numeroProcesso: z.string().describe("Número CNJ literal ou 'n/i'. PROIBIDO completar dígitos."),
  classe: z.string(),
  unidade: z.string().describe("Vara/Juizado/Comarca exatamente como nos autos."),
  partes: z.object({
    polo_ativo: z.array(z.string()),
    polo_passivo: z.array(z.string()),
    terceiros: z.array(z.string()),
  }),
  cronologia: z.array(EventoCronologia),
  pedidos: z.array(Pedido),
  preliminares: z.array(z.object({ arguidaPor: z.string(), tese: z.string(), local: Localizacao })),
  provas: z.array(Prova),
  pontosControvertidos: z.array(z.string()),
  faseProcessual: z.enum([
    "inicial_sem_liminar",
    "tutela_urgencia_pendente",
    "saneamento",
    "instrucao",
    "concluso_sentenca",
    "embargos_declaracao",
    "cumprimento_sentenca",
  ]),
  atoSugerido: z.enum(["despacho", "decisao_interlocutoria", "saneamento", "sentenca", "embargos_declaracao"]),
  alertas: z.array(z.string()).describe("Lacunas, ilegibilidades, divergências de valores/datas entre peças."),
});
export type DossieFatico = z.infer<typeof DossieFatico>;

/** Saída da Etapa 2 — Juiz Revisor / Redator Magistral. */
export const MinutaFinal = z.object({
  tipoAto: z.string(),
  ementa: z.string().nullable(),
  relatorio: z.string(),
  fundamentacao: z.object({
    b1_regularidade_processual: z.string(),
    b2_cerne_controversia: z.string(),
    b3_regime_juridico: z.string(),
    b4_confronto_probatorio: z.string(),
    b5_subsuncao: z.string(),
    b6_julgamento_por_pedido: z.string(),
    b7_consectarios_e_onus: z.string(),
  }),
  dispositivo: z.string(),
  pedidosApreciados: z.array(z.object({ pedidoId: z.string(), resultado: z.enum(["procedente", "improcedente", "parcialmente_procedente", "prejudicado", "extinto_sem_merito", "nao_se_aplica"]) })),
  precedentesCitados: z.array(z.string()),
});
export type MinutaFinal = z.infer<typeof MinutaFinal>;

/** Matriz de Conformidade da Lupa do Magistrado. */
export const DiagnosticoAuditoria = z.object({
  nota: z.number().min(0).max(10),
  adstricao: z.object({
    extraPetita: z.array(z.string()),
    ultraPetita: z.array(z.string()),
    citraPetita: z.array(z.string()).describe("Pedidos não apreciados — risco de Embargos de Declaração."),
  }),
  alucinacoes: z.array(z.object({ trecho: z.string(), motivo: z.string(), fonteCorreta: z.string().nullable() })),
  precedentesVinculantes: z.array(z.object({ precedente: z.string(), situacao: z.enum(["respeitado", "violado", "nao_citado_aplicavel"]) })),
  consectarios: z.string(),
  recomendacoes: z.array(z.string()),
  minutaGabarito: z.string(),
});
export type DiagnosticoAuditoria = z.infer<typeof DiagnosticoAuditoria>;

/** Mesa de Audiência — 5 pilares da lide. */
export const PainelAudiencia = z.object({
  fatosIncontroversos: z.array(z.string()),
  controversias: z.array(z.string()),
  provasProduzidas: z.array(z.string()),
  onusDaProva: z.array(z.string()),
  pontosASanear: z.array(z.string()),
  perguntas: z.array(z.object({ destinatario: z.string(), pergunta: z.string(), finalidade: z.string() })),
});
export type PainelAudiencia = z.infer<typeof PainelAudiencia>;

/** Precedente indexado (STF, STJ, TNU, TJGO ou do próprio gabinete). */
export const Precedente = z.object({
  tribunal: z.enum(["STF", "STJ", "TNU", "TJGO", "GABINETE"]),
  tipo: z.enum(["sumula", "sumula_vinculante", "tema_repetitivo", "repercussao_geral", "informativo", "irdr", "enunciado", "tese_gabinete"]),
  identificador: z.string().describe("Ex.: 'Súmula 479', 'Tema 1.049', 'Informativo 812'."),
  enunciado: z.string(),
  palavrasChave: z.array(z.string()),
  fonte: z.string().nullable(),
});
export type Precedente = z.infer<typeof Precedente>;
export const LotePrecedentes = z.object({ itens: z.array(Precedente) });
