import { randomUUID } from "node:crypto";
import { contarParagrafosDensos, verificarFidelidade } from "../../shared/fidelity.js";
import { exigePisoDeParagrafos, REGRA_POR_ATO, type TipoAto } from "../../shared/gabinete.js";
import { DossieFatico, MinutaFinal } from "../../shared/schemas.js";
import { STAGE1_SYSTEM, stage1User } from "../ai/prompts/stage1AssessorFatico.js";
import { stage2System, stage2User } from "../ai/prompts/stage2JuizRevisor.js";
import type { AuthUser } from "../middleware/requireAuth.js";
import { repo } from "../repositories/index.js";
import { generateValidated, schemaText } from "../services/llmJson.js";
import { rankPrecedentes } from "../services/precedentMatcher.js";
import { chunkText, mapLimit } from "./chunking.js";
import { gerarResumoExecutivo } from "./synopsis.js";

/** Acima deste tamanho a Etapa 1 roda por blocos e os dossiês parciais são fundidos deterministicamente. */
const STAGE1_MAX_CHARS = 900_000;
const MIN_PARAGRAFOS = 14;

export interface MinutaInput {
  autos: string;
  tipoAto?: TipoAto;
  unidadeId?: string | null;
  promptId?: string | null;
  paradigmaId?: string | null;
  instrucao?: string;
  usarTeses?: boolean;
}

export interface MinutaOutput {
  id: string;
  dossie: DossieFatico;
  minuta: MinutaFinal;
  markdown: string;
  resumoExecutivo: string;
  verificacoes: {
    dadosNaoEncontradosNosAutos: ReturnType<typeof verificarFidelidade>;
    paragrafosDensos: number;
    /** Piso aplicável: 14 em sentença; 0 nos demais atos. */
    pisoParagrafos: number;
    pedidosNaoApreciados: string[];
  };
  tipoAto: Exclude<TipoAto, "auto">;
  modelos: { etapa1: string; etapa2: string };
}

export function mergeDossies(parts: DossieFatico[]): DossieFatico {
  if (parts.length === 1) return parts[0];
  const first = (f: (d: DossieFatico) => string) => parts.map(f).find((v) => v && v !== "n/i") ?? "n/i";
  const uniq = (a: string[]) => Array.from(new Set(a));
  const last = parts[parts.length - 1];
  const pedidos = parts.flatMap((p) => p.pedidos);
  const seen = new Set<string>();
  return {
    numeroProcesso: first((d) => d.numeroProcesso),
    classe: first((d) => d.classe),
    unidade: first((d) => d.unidade),
    partes: {
      polo_ativo: uniq(parts.flatMap((p) => p.partes.polo_ativo)),
      polo_passivo: uniq(parts.flatMap((p) => p.partes.polo_passivo)),
      terceiros: uniq(parts.flatMap((p) => p.partes.terceiros)),
    },
    cronologia: parts.flatMap((p) => p.cronologia),
    // renumera para manter ids únicos após a fusão, sem descartar pedidos
    pedidos: pedidos
      .filter((p) => {
        const k = `${p.litisconsorte}|${p.descricao}|${p.valor}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((p, i) => ({ ...p, id: `P${i + 1}` })),
    preliminares: parts.flatMap((p) => p.preliminares),
    provas: parts.flatMap((p) => p.provas),
    pontosControvertidos: uniq(parts.flatMap((p) => p.pontosControvertidos)),
    faseProcessual: last.faseProcessual,
    atoSugerido: last.atoSugerido,
    alertas: uniq([...parts.flatMap((p) => p.alertas), `Autos processados em ${parts.length} blocos — conferir continuidade da cronologia.`]),
  };
}

export function minutaToMarkdown(m: MinutaFinal): string {
  const f = m.fundamentacao;
  // Despachos e decisões simples chegam com blocos vazios: não geram seção vazia.
  const fund = [f.b1_regularidade_processual, f.b2_cerne_controversia, f.b3_regime_juridico, f.b4_confronto_probatorio, f.b5_subsuncao, f.b6_julgamento_por_pedido, f.b7_consectarios_e_onus]
    .map((b) => b.trim())
    .filter(Boolean)
    .join("\n\n");
  return [
    m.ementa ? `**${m.ementa}**\n` : "",
    `## RELATÓRIO\n\n${m.relatorio}`,
    fund ? `## FUNDAMENTAÇÃO\n\n${fund}` : "",
    `## DISPOSITIVO\n\n${m.dispositivo}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function gerarMinuta(user: AuthUser, input: MinutaInput): Promise<MinutaOutput> {
  const r = repo();

  // ── ETAPA 1: Assessor Fático (temperatura 0.0) ──
  const s1Schema = schemaText(DossieFatico);
  const blocos = chunkText(input.autos, STAGE1_MAX_CHARS);
  const parciais = await mapLimit(blocos, 2, (bloco, i) =>
    generateValidated(user, "minuta", DossieFatico, {
      system: STAGE1_SYSTEM,
      messages: [{ role: "user", content: (blocos.length > 1 ? `BLOCO ${i + 1} DE ${blocos.length} DOS AUTOS.\n\n` : "") + stage1User(bloco, s1Schema) }],
      temperature: 0,
    }),
  );
  const dossie = mergeDossies(parciais.map((p) => p.data));

  // ── Contexto do gabinete: paradigma, teses e precedentes pertinentes ──
  // Tipo de ato: escolha do assessor ou, em "auto", o sugerido pela Etapa 1 a partir da fase processual.
  const sugerido = { despacho: "despacho", decisao_interlocutoria: "decisao", saneamento: "decisao", sentenca: "sentenca", embargos_declaracao: "embargos" } as const;
  const tipoAto: Exclude<TipoAto, "auto"> = input.tipoAto && input.tipoAto !== "auto" ? input.tipoAto : sugerido[dossie.atoSugerido];
  const piso = exigePisoDeParagrafos(tipoAto) ? MIN_PARAGRAFOS : 0;

  const [paradigma, teses, basePrecedentes, unidades, promptArea] = await Promise.all([
    input.paradigmaId ? r.paradigmas.get(user.tenantId, input.paradigmaId) : Promise.resolve(null),
    input.usarTeses === false ? Promise.resolve([]) : r.teses.listar(user.tenantId),
    r.precedentes.listar(user.tenantId),
    input.unidadeId ? r.unidades.listar(user.tenantId) : Promise.resolve([]),
    input.promptId ? r.prompts.get(user.tenantId, input.promptId) : Promise.resolve(null),
  ]);
  const unidade = unidades.find((u) => u.id === input.unidadeId) ?? null;
  const tema = [...dossie.pedidos.map((p) => p.descricao), ...dossie.pontosControvertidos, dossie.classe].join(" ");
  const precedentes = rankPrecedentes(tema, basePrecedentes);

  // ── ETAPA 2: Juiz Revisor / Redator Magistral ──
  const s2Schema = schemaText(MinutaFinal);
  const system = stage2System({
    regraDoAto: REGRA_POR_ATO[tipoAto],
    unidade,
    promptArea: promptArea?.ativo === false ? null : promptArea,
    paradigma,
    teses: teses.filter((t) => t.ativa),
    precedentes,
    instrucaoDoAssessor: input.instrucao,
  });
  const dossieJson = JSON.stringify(dossie);
  let etapa2 = await generateValidated(user, "minuta", MinutaFinal, {
    system,
    messages: [{ role: "user", content: stage2User(dossieJson, s2Schema) }],
    temperature: 0.2,
  });

  // Piso de extensão: uma rodada de aprofundamento se a fundamentação vier telegráfica.
  const fundamentacaoTexto = () => Object.values(etapa2.data.fundamentacao).join("\n\n");
  if (piso && contarParagrafosDensos(fundamentacaoTexto()) < piso) {
    etapa2 = await generateValidated(user, "minuta", MinutaFinal, {
      system,
      messages: [
        { role: "user", content: stage2User(dossieJson, s2Schema) },
        { role: "assistant", content: JSON.stringify(etapa2.data) },
        { role: "user", content: `A fundamentação tem menos de ${MIN_PARAGRAFOS} parágrafos densos. Aprofunde os blocos B4, B5 e B6 com o confronto documento a documento e as transcrições literais do dossiê, sem acrescentar fatos novos. Devolva o JSON completo.` },
      ],
      temperature: 0.2,
    });
  }

  const minuta = etapa2.data;
  const markdown = minutaToMarkdown(minuta);
  const apreciados = new Set(minuta.pedidosApreciados.map((p) => p.pedidoId));
  const pedidosNaoApreciados = dossie.pedidos.filter((p) => !apreciados.has(p.id)).map((p) => `${p.id} — ${p.litisconsorte}: ${p.descricao}`);

  const resumoExecutivo = await gerarResumoExecutivo(user, input.autos);
  const id = randomUUID();
  const out: MinutaOutput = {
    id,
    dossie,
    minuta,
    markdown,
    resumoExecutivo,
    verificacoes: {
      dadosNaoEncontradosNosAutos: verificarFidelidade(markdown, input.autos),
      paragrafosDensos: contarParagrafosDensos(fundamentacaoTexto()),
      pisoParagrafos: piso,
      pedidosNaoApreciados,
    },
    tipoAto,
    modelos: { etapa1: parciais.map((p) => p.result.model).join(", "), etapa2: etapa2.result.model },
  };

  await r.minutas.registrar(user.tenantId, {
    id,
    numeroProcesso: dossie.numeroProcesso,
    tipoAto: minuta.tipoAto,
    criadoPor: user.uid,
    criadoEm: Date.now(),
    resumoExecutivo,
    minuta: { dossie, minuta, markdown },
    auditoriaAutomatica: out.verificacoes,
  });
  return out;
}
