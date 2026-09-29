import type { Precedente } from "../../shared/schemas.js";
import type { Funcionalidade } from "../../shared/pricing.js";

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
  role: string;
  tenantId: string;
  ativo: boolean;
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
  usd: number;
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
    salvar(u: Usuario): Promise<void>;
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
  };
  uso: {
    registrar(r: RegistroUso): Promise<void>;
    listar(desde: number, tenantId?: string): Promise<RegistroUso[]>;
  };
}
