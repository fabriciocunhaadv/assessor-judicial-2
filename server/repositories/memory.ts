import type { Paradigma, PrecedenteSalvo, RegistroMinuta, RegistroUso, Repositorio, Tese, Usuario } from "./types.js";

/** Repositório em memória — apenas desenvolvimento e testes. */
export function createMemoryRepo(): Repositorio {
  const usuarios = new Map<string, Usuario>();
  const teses = new Map<string, Map<string, Tese>>();
  const paradigmas = new Map<string, Map<string, Paradigma>>();
  const precedentes = new Map<string, Map<string, PrecedenteSalvo>>();
  const minutas = new Map<string, RegistroMinuta[]>();
  const uso: RegistroUso[] = [];
  const bucket = <T>(m: Map<string, Map<string, T>>, k: string) => {
    if (!m.has(k)) m.set(k, new Map());
    return m.get(k)!;
  };

  return {
    usuarios: {
      async get(uid) { return usuarios.get(uid) ?? null; },
      async listarDoGabinete(t) { return [...usuarios.values()].filter((u) => u.tenantId === t); },
      async salvar(u) { usuarios.set(u.uid, { ...(usuarios.get(u.uid) ?? {}), ...u }); },
    },
    teses: {
      async listar(t) { return [...bucket(teses, t).values()]; },
      async salvar(t, x) { const b = bucket(teses, t); b.set(x.id, { ...(b.get(x.id) ?? {}), ...x }); },
    },
    paradigmas: {
      async listar(t) { return [...bucket(paradigmas, t).values()]; },
      async get(t, id) { return bucket(paradigmas, t).get(id) ?? null; },
      async salvar(t, x) { const b = bucket(paradigmas, t); b.set(x.id, { ...(b.get(x.id) ?? {}), ...x }); },
    },
    precedentes: {
      async listar(t) { return [...bucket(precedentes, t).values()]; },
      async incluir(t, itens) { const b = bucket(precedentes, t); itens.forEach((i) => b.set(i.id, { ...(b.get(i.id) ?? {}), ...i })); return itens.length; },
    },
    minutas: {
      async registrar(t, r) { minutas.set(t, [r, ...(minutas.get(t) ?? [])]); },
      async listar(t, limite = 50) { return (minutas.get(t) ?? []).slice(0, limite); },
    },
    uso: {
      async registrar(r) { uso.push(r); },
      async listar(desde, t) { return uso.filter((u) => u.em >= desde && (!t || u.tenantId === t)); },
    },
  };
}
