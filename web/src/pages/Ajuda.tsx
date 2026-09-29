import { BookOpen, CalendarDays, Calculator, FileText, Gavel, History, LifeBuoy, MessageSquare, Scale, ScanSearch, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "../components/ui";
import { CHANGELOG } from "../lib/changelog";

const MODULOS: { icone: ReactNode; titulo: string; texto: string }[] = [
  { icone: <FileText className="h-4 w-4" />, titulo: "Nova Análise", texto: "Envie os autos em PDF (ou cole o texto), escolha o prompt da área e o tipo de ato. A Etapa 1 extrai cronologia, pedidos de cada litisconsorte e provas com Mov./Arq./Pág.; a Etapa 2 redige a minuta. A aba Conferência aponta pedidos não julgados e valores, datas ou números que não aparecem nos autos. Baixe em Word para colar no PROJUDI." },
  { icone: <ScanSearch className="h-4 w-4" />, titulo: "Auditoria Ouro (Lupa)", texto: "Confira a minuta do assessor contra os autos antes da assinatura: extra, ultra e citra petita, alucinações, precedentes e consectários, com minuta gabarito. Cada auditoria fica salva em Processos auditados." },
  { icone: <Gavel className="h-4 w-4" />, titulo: "Mesa de Audiência", texto: "Os 5 pilares da lide, perguntas sugeridas para testemunhas e partes e o redator de termo ou de homologação de acordo." },
  { icone: <MessageSquare className="h-4 w-4" />, titulo: "Chat & Refino", texto: "Peça ajustes na minuta (\"converta para improcedência\", \"aprecie a tutela\"). O chat usa o Resumo Executivo, não os autos inteiros, o que reduz custo e tempo." },
  { icone: <CalendarDays className="h-4 w-4" />, titulo: "Agenda", texto: "Prazos, audiências e diligências do gabinete. A calculadora conta dias úteis pelo CPC e salva o vencimento na agenda." },
  { icone: <Scale className="h-4 w-4" />, titulo: "Teses & Modelos", texto: "Caderno de Teses (entra em todas as minutas), Minutas Paradigma (clonam o estilo do juiz com ⚡ Injetar no Prompt) e teses avulsas." },
  { icone: <BookOpen className="h-4 w-4" />, titulo: "Súmulas & Precedentes", texto: "Importe PDFs de informativos e cadernos; os julgados pertinentes ao tema entram automaticamente nas minutas." },
  { icone: <Sparkles className="h-4 w-4" />, titulo: "Prompts por Área", texto: "Instruções do gabinete para cada matéria. O prompt ativo aparece no topo da tela." },
  { icone: <Calculator className="h-4 w-4" />, titulo: "Legislação & Juros", texto: "Regimes de correção e juros por microssistema e calculadora da Lei nº 14.905/2024." },
  { icone: <FileText className="h-4 w-4" />, titulo: "Guia do PROJUDI", texto: "Rotinas do gabinete no PROJUDI, com busca." },
  { icone: <Users className="h-4 w-4" />, titulo: "Equipe e Super Admin", texto: "O Juiz Titular convida a equipe pelo e-mail Google, define papéis e unidades liberadas e publica avisos. O Super Admin cria gabinetes e acompanha o consumo." },
  { icone: <History className="h-4 w-4" />, titulo: "Histórico", texto: "As últimas minutas do gabinete (sem os autos) para reabrir e continuar." },
];

export default function Ajuda() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><LifeBuoy className="h-5 w-5" /></div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Manual de uso</h1>
          <p className="text-sm text-slate-500">O que cada módulo faz e o que mudou em cada versão.</p>
        </div>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card title="Módulos" bodyClass="grid gap-3 p-4 md:grid-cols-2">
          {MODULOS.map((m) => (
            <div key={m.titulo} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><span className="text-emerald-600">{m.icone}</span>{m.titulo}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{m.texto}</p>
            </div>
          ))}
        </Card>
        <Card title="Registro de mudanças" bodyClass="space-y-4 p-4">
          {CHANGELOG.map((c) => (
            <div key={c.titulo} className="border-l-2 border-emerald-500 pl-3">
              <p className="text-xs text-slate-500">{c.data}</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{c.titulo}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-slate-600 dark:text-slate-300">{c.itens.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </Card>
      </div>
      <p className="text-xs text-slate-500">Regras fixas em toda minuta: julgar exatamente o que foi pedido, copiar literalmente números, valores e datas dos autos, citar Mov./Arq./Pág. e nunca sobrescrever dados cadastrados pela equipe.</p>
    </div>
  );
}
