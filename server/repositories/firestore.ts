import type { Firestore } from "firebase-admin/firestore";
import type { Repositorio } from "./types.js";

/**
 * Layout no Firestore:
 *   users/{uid}
 *   gabinetes/{tenantId}/teses/{id}            (+ /historico/{ts} a cada alteração)
 *   gabinetes/{tenantId}/paradigmas/{id}       (+ /historico/{ts})
 *   gabinetes/{tenantId}/precedentes/{id}
 *   gabinetes/{tenantId}/minutas/{id}
 *   usage_logs/{auto}
 *   invites/{email}                             convites pendentes
 *   tenants/{tenantId}                          gabinetes (Super Admin)
 *   gabinetes/{tenantId}/unidades/{id}          lotações
 *   gabinetes/{tenantId}/prompts/{id}           (+ /historico/{ts})
 *   config/comunicado, gabinetes/{tenantId}/config/comunicado
 *   gabinetes/{tenantId}/config/caderno         (+ /historico/{ts})
 *   gabinetes/{tenantId}/auditorias/{id}
 * Todas as escritas usam { merge: true }. Nenhuma rotina de seed.
 */
export function createFirestoreRepo(db: Firestore): Repositorio {
  const gab = (t: string) => db.collection("gabinetes").doc(t);

  async function salvarComHistorico(col: FirebaseFirestore.CollectionReference, id: string, data: object) {
    const ref = col.doc(id);
    await db.runTransaction(async (tx) => {
      const atual = await tx.get(ref);
      if (atual.exists) tx.set(ref.collection("historico").doc(String(Date.now())), atual.data()!);
      tx.set(ref, data, { merge: true });
    });
  }

  return {
    usuarios: {
      async get(uid) { const s = await db.collection("users").doc(uid).get(); return s.exists ? (s.data() as any) : null; },
      async listarDoGabinete(t) { const q = await db.collection("users").where("tenantId", "==", t).get(); return q.docs.map((d) => d.data() as any); },
      async listarTodos() { const q = await db.collection("users").get(); return q.docs.map((d) => d.data() as any); },
      async salvar(u) { await db.collection("users").doc(u.uid).set(u, { merge: true }); },
    },
    convites: {
      async get(e) { const s = await db.collection("invites").doc(e.toLowerCase()).get(); return s.exists ? (s.data() as any) : null; },
      async listarDoGabinete(t) { const q = await db.collection("invites").where("tenantId", "==", t).get(); return q.docs.map((d) => d.data() as any); },
      async salvar(c) { await db.collection("invites").doc(c.email.toLowerCase()).set({ ...c, email: c.email.toLowerCase() }, { merge: true }); },
      async remover(e) { await db.collection("invites").doc(e.toLowerCase()).delete(); },
    },
    unidades: {
      async listar(t) { const q = await gab(t).collection("unidades").get(); return q.docs.map((d) => d.data() as any); },
      async salvar(t, x) { await gab(t).collection("unidades").doc(x.id).set(x, { merge: true }); },
    },
    prompts: {
      async listar(t) { const q = await gab(t).collection("prompts").get(); return q.docs.map((d) => d.data() as any); },
      async get(t, id) { const s = await gab(t).collection("prompts").doc(id).get(); return s.exists ? (s.data() as any) : null; },
      async salvar(t, x) { await salvarComHistorico(gab(t).collection("prompts"), x.id, x); },
    },
    gabinetes: {
      async listar() { const q = await db.collection("tenants").get(); return q.docs.map((d) => d.data() as any); },
      async get(id) { const s = await db.collection("tenants").doc(id).get(); return s.exists ? (s.data() as any) : null; },
      async salvar(g) { await db.collection("tenants").doc(g.id).set(g, { merge: true }); },
    },
    caderno: {
      async get(t) { const s = await gab(t).collection("config").doc("caderno").get(); return s.exists ? (s.data() as any) : null; },
      async salvar(t, c) { await salvarComHistorico(gab(t).collection("config"), "caderno", c); },
    },
    auditorias: {
      async registrar(t, a) { await gab(t).collection("auditorias").doc(a.id).set(a, { merge: true }); },
      async listar(t, limite = 50) { const q = await gab(t).collection("auditorias").orderBy("criadoEm", "desc").limit(limite).get(); return q.docs.map((d) => d.data() as any); },
    },
    comunicados: {
      async get(t) { const ref = t ? gab(t).collection("config").doc("comunicado") : db.collection("config").doc("comunicado"); const s = await ref.get(); return s.exists ? (s.data() as any) : null; },
      async salvar(t, c) { const ref = t ? gab(t).collection("config").doc("comunicado") : db.collection("config").doc("comunicado"); await ref.set(c, { merge: true }); },
    },
    teses: {
      async listar(t) { const q = await gab(t).collection("teses").get(); return q.docs.map((d) => d.data() as any); },
      async salvar(t, x) { await salvarComHistorico(gab(t).collection("teses"), x.id, x); },
    },
    paradigmas: {
      async listar(t) { const q = await gab(t).collection("paradigmas").get(); return q.docs.map((d) => d.data() as any); },
      async get(t, id) { const s = await gab(t).collection("paradigmas").doc(id).get(); return s.exists ? (s.data() as any) : null; },
      async salvar(t, x) { await salvarComHistorico(gab(t).collection("paradigmas"), x.id, x); },
    },
    precedentes: {
      async listar(t) { const q = await gab(t).collection("precedentes").get(); return q.docs.map((d) => d.data() as any); },
      async incluir(t, itens) {
        const col = gab(t).collection("precedentes");
        for (let i = 0; i < itens.length; i += 400) {
          const batch = db.batch();
          itens.slice(i, i + 400).forEach((it) => batch.set(col.doc(it.id), it, { merge: true }));
          await batch.commit();
        }
        return itens.length;
      },
    },
    minutas: {
      async registrar(t, r) { await gab(t).collection("minutas").doc(r.id).set(r, { merge: true }); },
      async listar(t, limite = 50) { const q = await gab(t).collection("minutas").orderBy("criadoEm", "desc").limit(limite).get(); return q.docs.map((d) => d.data() as any); },
      async contar(t) { const q = t ? gab(t).collection("minutas") : db.collectionGroup("minutas"); const s = await q.count().get(); return s.data().count; },
    },
    uso: {
      async registrar(r) { await db.collection("usage_logs").add(r); },
      async listar(desde, t) {
        let q = db.collection("usage_logs").where("em", ">=", desde);
        if (t) q = q.where("tenantId", "==", t);
        const s = await q.get();
        return s.docs.map((d) => d.data() as any);
      },
    },
  };
}
