import type { Precedente } from "../../shared/schemas.js";
import type { Funcionalidade } from "../../shared/pricing.js";

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
  role: string;
  tenantId: string;
  ativo: boolean;
  /** Ids das unidades (lotações) que o membro pode usar. Vazio = todas as do gabinete. */
  unidadesLiberadas?: string[];
}

/** Convite por e-mail: vira perfil no primeiro login com esse e-mail (Google). */
export interface Convite {
  email: string;
  nome: string;
  role: string;
  tenantId: string;
  unidadesLiberadas: string[];
  convidadoPor: string;
  criadoEm: number;
}

/** Lotação / unidade judiciária (vara, juizado, comarca). */
export interface Unidade {
  id: string;
  nome: string;
  comarca: string;
  competencia: string;
  ativa: boolean;
}

/** Prompt do gabinete por área: instruções que entram na Etapa 2 quando selecionado. */
export interface PromptGabinete {
  id: string;
  titulo: string;
  area: string;
  texto: string;
  ativo: boolean;
  atualizadoPor: string;
  atualizadoEm: number;
}

export interface Gabinete {
  id: string;
  nome: string;
  juizTitular: string;
  status: "ativo" | "suspenso";
  criadoEm: number;
}

/** Caderno de Teses em texto corrido (um documento por gabinete). */
export interface Caderno {
  texto: string;
  atualizadoPor: string;
  atualizadoEm: number;
}

/** Compromisso da agenda do gabinete (prazo, audiência, diligência). */
export interface EventoAgenda {
  id: string;
  titulo: string;
  tipo: "prazo" | "audiencia" | "diligencia" | "outro";
  data: string; // AAAA-MM-DD
  hora: string; // HH:MM ou ""
  processo: string;
  responsavel: string;
  unidadeId: string;
  observacao: string;
  concluido: boolean;
  criadoPor: string;
  criadoEm: number;
}

export interface RegistroAuditoria {
  id: string;
  numeroProcesso: string;
  assessorNome: string;
  nota: number;
  pendencias: number;
  criadoPor: string;
  criadoEm: number;
  diagnostico: unknown;
}

export interface Comunicado {
  texto: string;
  nivel: "info" | "alerta";
  ativo: boolean;
  atualizadoPor: string;
  atualizadoEm: number;
}

export interface Tese {
  id: string;
  titulo: string;
  texto: string;
  ativa: boolean;
  atualizadoPor: string;
  atualizadoEm: number;
}

export interface Paradigma {
  id: string;
  titulo: string;
  tipoAto: string;
  texto: string;
  atualizadoPor: string;
  atualizadoEm: number;
}

export interface PrecedenteSalvo extends Precedente {
  id: string;
  importadoEm: number;
  importadoPor: string;
}

export interface RegistroMinuta {
  id: string;
  numeroProcesso: string;
  tipoAto: string;
  criadoPor: string;
  criadoEm: number;
  resumoExecutivo: string;
  minuta: unknown;
  auditoriaAutomatica: unknown;
}

export interface RegistroUso {
  tenantId: string;
  uid: string;
  funcionalidade: Funcionalidade;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Tokens lidos/gravados no cache de prompt (registros antigos não têm). */
  cacheLeitura?: number;
  cacheEscrita?: number;
  buscasWeb?: number;
  usd: number;
  /** Quanto o cache poupou nesta chamada. */
  economiaUsd?: number;
  tabelado: boolean;
  em: number;
}

/**
 * Regras de persistência (invariantes do produto):
 *  - Nenhum método substitui um documento existente por um "padrão" do sistema.
 *  - `salvar` faz MERGE e guarda a versão anterior em histórico (teses/paradigmas).
 *  - Não existe seed automático: coleção vazia permanece vazia até o usuário cadastrar.
 */
export interface Repositorio {
  usuarios: {
    get(uid: string): Promise<Usuario | null>;
    listarDoGabinete(tenantId: string): Promise<Usuario[]>;
    listarTodos(): Promise<Usuario[]>;
    salvar(u: Usuario): Promise<void>;
  };
  convites: {
    get(email: string): Promise<Convite | null>;
    listarDoGabinete(tenantId: string): Promise<Convite[]>;
    salvar(c: Convite): Promise<void>;
    remover(email: string): Promise<void>;
  };
  unidades: {
    listar(tenantId: string): Promise<Unidade[]>;
    salvar(tenantId: string, u: Unidade): Promise<void>;
  };
  prompts: {
    listar(tenantId: string): Promise<PromptGabinete[]>;
    get(tenantId: string, id: string): Promise<PromptGabinete | null>;
    salvar(tenantId: string, p: PromptGabinete): Promise<void>;
  };
  gabinetes: {
    listar(): Promise<Gabinete[]>;
    get(id: string): Promise<Gabinete | null>;
    salvar(g: Gabinete): Promise<void>;
  };
  caderno: {
    get(tenantId: string): Promise<Caderno | null>;
    salvar(tenantId: string, c: Caderno): Promise<void>;
  };
  /** Documentos de texto do gabinete por chave (ex.: guia_projudi, agenda_config). */
  documentos: {
    get(tenantId: string, chave: string): Promise<Caderno | null>;
    salvar(tenantId: string, chave: string, c: Caderno): Promise<void>;
  };
  agenda: {
    listar(tenantId: string, de: string, ate: string): Promise<EventoAgenda[]>;
    get(tenantId: string, id: string): Promise<EventoAgenda | null>;
    salvar(tenantId: string, e: EventoAgenda): Promise<void>;
    remover(tenantId: string, id: string): Promise<void>;
  };
  auditorias: {
    registrar(tenantId: string, a: RegistroAuditoria): Promise<void>;
    listar(tenantId: string, limite?: number): Promise<RegistroAuditoria[]>;
  };
  comunicados: {
    /** tenantId null = comunicado global (Super Admin). */
    get(tenantId: string | null): Promise<Comunicado | null>;
    salvar(tenantId: string | null, c: Comunicado): Promise<void>;
  };
  teses: {
    listar(tenantId: string): Promise<Tese[]>;
    salvar(tenantId: string, t: Tese): Promise<void>;
  };
  paradigmas: {
    listar(tenantId: string): Promise<Paradigma[]>;
    get(tenantId: string, id: string): Promise<Paradigma | null>;
    salvar(tenantId: string, p: Paradigma): Promise<void>;
  };
  precedentes: {
    listar(tenantId: string): Promise<PrecedenteSalvo[]>;
    /** Inclusão por merge: itens com o mesmo id são atualizados, nenhum outro é removido. */
    incluir(tenantId: string, itens: PrecedenteSalvo[]): Promise<number>;
  };
  minutas: {
    registrar(tenantId: string, r: RegistroMinuta): Promise<void>;
    listar(tenantId: string, limite?: number): Promise<RegistroMinuta[]>;
    /** Quantidade de minutas (de um gabinete ou de todos). */
    contar(tenantId?: string): Promise<number>;
  };
  uso: {
    registrar(r: RegistroUso): Promise<void>;
    listar(desde: number, tenantId?: string): Promise<RegistroUso[]>;
  };
}
