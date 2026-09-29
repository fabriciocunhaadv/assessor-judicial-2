/** Registro de mudanças exibido no Manual. Acrescente uma entrada a cada entrega. */
export const CHANGELOG: { data: string; titulo: string; itens: string[] }[] = [
  {
    data: "29/09/2026",
    titulo: "Agenda, Guia do PROJUDI, Word e Manual",
    itens: [
      "Exportação da minuta em Word (.docx) no padrão forense, com cabeçalho da unidade e número do processo.",
      "Agenda do gabinete com calendário mensal, prazos, audiências e diligências, e vínculo opcional com o Google Agenda.",
      "Calculadora de prazos em dias úteis (CPC, arts. 219, 220 e 224), com recesso forense e datas sem expediente informadas.",
      "Guia do PROJUDI do gabinete com busca por rotina.",
      "Este Manual, com o registro de mudanças.",
    ],
  },
  {
    data: "29/09/2026",
    titulo: "Lupa, Caderno de Teses, súmulas e legislação",
    itens: [
      "Lupa do Magistrado com Nova auditoria e Processos auditados salvos.",
      "Caderno de Teses em texto corrido, aplicado em todas as minutas e auditorias.",
      "Súmulas e informativos em cartões com filtros, paginação e cópia da ementa.",
      "Legislação & Juros: catálogo de regimes de correção e juros e calculadora da Lei nº 14.905/2024.",
      "Prompts com backup e importação em JSON.",
    ],
  },
  {
    data: "29/09/2026",
    titulo: "Layout e configuração do gabinete",
    itens: [
      "Barra superior com unidade judiciária, prompt ativo e menu Configurações; menu lateral agrupado.",
      "Nova Análise com tipo de minuta, entrada por PDF ou texto, Minuta Paradigma e co-piloto.",
      "Equipe com convite por e-mail, lotações e aviso à equipe; Painel Super Admin.",
    ],
  },
  {
    data: "29/09/2026",
    titulo: "Sistema reconstruído",
    itens: [
      "Minuta em duas etapas (Assessor Fático e Juiz Revisor) com conferência automática de pedidos, valores e datas.",
      "Motor de IA com Claude e Gemini, troca automática de chave e de modelo em caso de sobrecarga.",
    ],
  },
];
