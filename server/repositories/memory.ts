import type { Comunicado, Convite, Gabinete, Paradigma, PrecedenteSalvo, PromptGabinete, RegistroMinuta, RegistroUso, Repositorio, Tese, Unidade, Usuario } from "./types.js";

/** Repositório em memória — apenas desenvolvimento e testes. */
export function createMemoryRepo(): Repositorio {
  const usuarios = new Map<string, Usuario>();
  const teses = new Map<string, Map<string, Tese>>();
  const paradigmas = new Map<string, Map<string, Paradigma>>();
  const precedentes = new Map<string, Map<string, PrecedenteSalvo>>();
  const minutas = new Map<string, RegistroMinuta[]>();
  const uso: RegistroUso[] = [];
  const convites = new Map<string, Convite>();
  const unidades = new Map<string, Map<string, Unidade>>();
  const prompts = new Map<string, Map<string, PromptGabinete>>();
  const gabinetes = new Map<string, Gabinete>();
  const comunicados = new Map<string, Comunicado>();
  const bucket = <T>(m: Map<string, Map<string, T>>, k: string) => {
    if (!m.has(k)) m.set(k, new Map());
    return m.get(k)!;
  };

  return {
    usuarios: {
      async get(uid) { return usuarios.get(uid) ?? null; },
      async listarDoGabinete(t) { return [...usuarios.values()].filter((u) => u.tenantId === t); },
      async listarTodos() { return [...usuarios.values()]; },
      async salvar(u) { usuarios.set(u.uid, { ...(usuarios.get(u.uid) ?? {}), ...u }); },
    },
    convites: {
      async get(e) { return convites.get(e.toLowerCase()) ?? null; },
      async listarDoGabinete(t) { return [...convites.values()].filter((c) => c.tenantId === t); },
      async salvar(c) { convites.set(c.email.toLowerCase(), { ...c, email: c.email.toLowerCase() }); },
      async remover(e) { convites.delete(e.toLowerCase()); },
    },
    unidades: {
      async listar(t) { return [...bucket(unidades, t).values()]; },
      async salvar(t, x) { const b = bucket(unidades, t); b.set(x.id, { ...(b.get(x.id) ?? {}), ...x }); },
    },
    prompts: {
      async listar(t) { return [...bucket(prompts, t).values()]; },
      async get(t, id) { return bucket(prompts, t).get(id) ?? null; },
      async salvar(t, x) { const b = bucket(prompts, t); b.set(x.id, { ...(b.get(x.id) ?? {}), ...x }); },
    },
    gabinetes: {
      async listar() { return [...gabinetes.values()]; },
      async get(id) { return gabinetes.get(id) ?? null; },
      async salvar(g) { gabinetes.set(g.id, { ...(gabinetes.get(g.id) ?? {}), ...g }); },
    },
    comunicados: {
      async get(t) { return comunicados.get(t ?? "__global__") ?? null; },
      async salvar(t, c) { comunicados.set(t ?? "__global__", c); },
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
      async contar(t) { return t ? (minutas.get(t) ?? []).length : [...minutas.values()].reduce((n, l) => n + l.length, 0); },
    },
    uso: {
      async registrar(r) { uso.push(r); },
      async listar(desde, t) { return uso.filter((u) => u.em >= desde && (!t || u.tenantId === t)); },
    },
  };
}
