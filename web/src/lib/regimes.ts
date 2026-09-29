/**
 * Catálogo de regimes de correção monetária e juros de mora por microssistema.
 * Conteúdo de referência para o assessor — sempre conferir a legislação e a jurisprudência vigentes.
 */
export interface Regime {
  id: string;
  titulo: string;
  area: string;
  resumo: string;
  correcao: string;
  juros: string;
  termos: string[];
  diplomas: { nome: string; artigos: string; nota: string }[];
  observacoes: string[];
}

export const REGIMES: Regime[] = [
  {
    id: "civil",
    titulo: "Obrigações civis gerais e responsabilidade civil",
    area: "Direito Civil e obrigações",
    resumo: "Lei nº 14.905/2024: IPCA para correção e taxa legal (Selic deduzido o IPCA) para juros, salvo índice ou taxa convencionados.",
    correcao: "IPCA (art. 389, parágrafo único, do CC), salvo índice convencionado ou previsto em lei específica.",
    juros: "Taxa legal = Selic deduzido o IPCA do período (art. 406, § 1º, do CC); se o resultado for negativo, considera-se zero (art. 406, § 3º).",
    termos: [
      "Dano material: correção desde o efetivo prejuízo (Súmula 43/STJ).",
      "Dano moral: correção desde o arbitramento (Súmula 362/STJ).",
      "Juros na responsabilidade extracontratual: desde o evento danoso (Súmula 54/STJ).",
      "Juros na responsabilidade contratual: desde a citação (art. 405 do CC).",
      "Obrigação positiva, líquida e com termo: mora desde o vencimento (art. 397 do CC).",
    ],
    diplomas: [
      { nome: "Lei nº 14.905/2024", artigos: "altera arts. 389, 395, 404 e 406 do CC", nota: "Uniformiza correção pelo IPCA e juros pela Selic deduzido o IPCA." },
      { nome: "Código Civil (Lei nº 10.406/2002)", artigos: "arts. 186, 389, 395, 397, 405, 406 e 927", nota: "Inadimplemento, mora e dever de indenizar." },
      { nome: "Código de Processo Civil (Lei nº 13.105/2015)", artigos: "arts. 141, 322, § 1º, 491 e 492", nota: "Juros e correção compreendidos no principal; adstrição e condenação líquida." },
    ],
    observacoes: [
      "A Lei nº 14.905/2024 está em vigor desde 30/08/2024. Para o período anterior, observe o direito intertemporal: a Corte Especial do STJ (REsp 1.795.982/SP, 2024) fixou a Selic como taxa do art. 406 na redação original.",
    ],
  },
  {
    id: "consumo",
    titulo: "Relações de consumo e fornecimento de serviços",
    area: "Direito do Consumidor",
    resumo: "Mesma regra geral do Código Civil (Lei nº 14.905/2024) para indenizações e repetição de indébito; dobra do art. 42 do CDC conforme a boa-fé objetiva.",
    correcao: "IPCA (art. 389, parágrafo único, do CC), aplicável às condenações em relações de consumo.",
    juros: "Taxa legal (Selic deduzido o IPCA), art. 406, §§ 1º e 3º, do CC.",
    termos: [
      "Repetição de indébito: correção desde cada desconto ou pagamento indevido.",
      "Juros: extracontratual desde o evento danoso (Súmula 54/STJ); contratual desde a citação (art. 405 do CC).",
      "Dano moral: correção desde o arbitramento (Súmula 362/STJ).",
    ],
    diplomas: [
      { nome: "Código de Defesa do Consumidor (Lei nº 8.078/1990)", artigos: "arts. 6º, VIII, 14 e 42, parágrafo único", nota: "Inversão do ônus da prova, responsabilidade objetiva e repetição em dobro." },
      { nome: "Súmula 479/STJ", artigos: "", nota: "Instituições financeiras respondem objetivamente por fortuito interno relativo a fraudes de terceiros." },
    ],
    observacoes: [
      "Repetição em dobro (art. 42, parágrafo único, do CDC): a Corte Especial do STJ (EAREsp 676.608/RS) dispensou a prova de má-fé, bastando conduta contrária à boa-fé objetiva, com modulação para indébitos cobrados após a publicação do acórdão (30/03/2021).",
    ],
  },
  {
    id: "fazenda",
    titulo: "Condenações contra a Fazenda Pública (não tributárias)",
    area: "Direito Administrativo e Fazenda Pública",
    resumo: "A partir de 09/12/2021 (EC nº 113/2021): Selic, uma única vez, abrangendo correção e juros. Antes: IPCA-E e juros da poupança (Tema 810/STF).",
    correcao: "Até 08/12/2021: IPCA-E (Tema 810/STF, RE 870.947). A partir de 09/12/2021: Selic acumulada, que já engloba a correção (art. 3º da EC nº 113/2021).",
    juros: "Até 08/12/2021: índice oficial da caderneta de poupança (art. 1º-F da Lei nº 9.494/1997). A partir de 09/12/2021: incluídos na Selic, vedada cumulação.",
    termos: [
      "Juros de mora desde a citação (art. 240 do CPC c/c art. 405 do CC), salvo regra específica.",
      "Correção desde a data em que cada parcela seria devida.",
    ],
    diplomas: [
      { nome: "Emenda Constitucional nº 113/2021", artigos: "art. 3º", nota: "Selic, uma única vez, até o efetivo pagamento." },
      { nome: "Lei nº 9.494/1997", artigos: "art. 1º-F", nota: "Juros da poupança nas condenações não tributárias (período anterior)." },
      { nome: "Tema 810/STF e Tema 905/STJ", artigos: "", nota: "Índices por natureza da condenação no período anterior à EC nº 113/2021." },
    ],
    observacoes: ["Nos Juizados Especiais da Fazenda Pública (Lei nº 12.153/2009) aplicam-se os mesmos parâmetros materiais."],
  },
  {
    id: "previdenciario",
    titulo: "Benefícios previdenciários",
    area: "Direito Previdenciário",
    resumo: "INPC para correção e juros da poupança até 08/12/2021 (Tema 905/STJ); depois, Selic (EC nº 113/2021).",
    correcao: "Até 08/12/2021: INPC (art. 41-A da Lei nº 8.213/1991; Tema 905/STJ). A partir de 09/12/2021: Selic (EC nº 113/2021).",
    juros: "Até 08/12/2021: poupança (art. 1º-F da Lei nº 9.494/1997), desde a citação válida (Súmula 204/STJ). A partir de 09/12/2021: incluídos na Selic.",
    termos: ["Correção de cada parcela desde o respectivo vencimento.", "Juros desde a citação válida (Súmula 204/STJ)."],
    diplomas: [
      { nome: "Lei nº 8.213/1991", artigos: "art. 41-A", nota: "Reajuste e correção dos benefícios pelo INPC." },
      { nome: "Emenda Constitucional nº 113/2021", artigos: "art. 3º", nota: "Selic a partir de 09/12/2021." },
    ],
    observacoes: [],
  },
  {
    id: "tributario",
    titulo: "Repetição de indébito tributário",
    area: "Direito Tributário",
    resumo: "Selic desde o pagamento indevido, vedada a cumulação com outros índices de correção ou juros.",
    correcao: "Selic, que engloba correção e juros (art. 39, § 4º, da Lei nº 9.250/1995), para tributos federais.",
    juros: "Incluídos na Selic. Tributos estaduais e municipais: mesma taxa usada para a cobrança do tributo em atraso, se prevista na lei local (Súmula 523/STJ).",
    termos: ["Desde cada pagamento indevido (Súmula 162/STJ, quanto à correção)."],
    diplomas: [
      { nome: "Lei nº 9.250/1995", artigos: "art. 39, § 4º", nota: "Selic na restituição e compensação de tributos federais." },
      { nome: "Súmula 523/STJ", artigos: "", nota: "Simetria entre a taxa de cobrança e a de repetição nos tributos estaduais." },
    ],
    observacoes: [],
  },
  {
    id: "jec",
    titulo: "Juizados Especiais Cíveis",
    area: "Juizado Especial Cível",
    resumo: "Parâmetros materiais do Código Civil (Lei nº 14.905/2024); regras próprias de sucumbência e de liquidez da sentença.",
    correcao: "IPCA (art. 389, parágrafo único, do CC).",
    juros: "Taxa legal (Selic deduzido o IPCA), art. 406 do CC.",
    termos: ["Sentença líquida, ainda que o pedido seja genérico (art. 38, parágrafo único, da Lei nº 9.099/1995)."],
    diplomas: [
      { nome: "Lei nº 9.099/1995", artigos: "arts. 38, 52 e 55", nota: "Sentença líquida, execução e ausência de custas e honorários em 1º grau, salvo litigância de má-fé." },
    ],
    observacoes: [],
  },
];
