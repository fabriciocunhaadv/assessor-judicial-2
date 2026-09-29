import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Modo dev: usuário local "dev" (super_admin) no gabinete "gabinete_dev", dados em memória.
process.env.AUTH_DISABLED = "true";
process.env.DATA_BACKEND = "memory";
process.env.NODE_ENV = "test";

let server: Server;
let base = "";
const chamar = async (metodo: string, caminho: string, corpo?: unknown) => {
  const r = await fetch(base + caminho, { method: metodo, headers: corpo ? { "content-type": "application/json" } : {}, body: corpo ? JSON.stringify(corpo) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};

beforeAll(async () => {
  const { createApp } = await import("../server/app");
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

describe("API do gabinete", () => {
  it("agenda: cria, lista por período, conclui e exclui", async () => {
    const c = await chamar("PUT", "/agenda", { titulo: "Prazo de contestação", tipo: "prazo", data: "2025-09-12", processo: "0000001-00.2025.8.09.0000" });
    expect(c.status).toBe(200);
    const lista = await chamar("GET", "/agenda?de=2025-09-01&ate=2025-09-30");
    expect(lista.json).toHaveLength(1);
    expect((await chamar("GET", "/agenda?de=2025-10-01&ate=2025-10-31")).json).toHaveLength(0);
    const up = await chamar("PUT", `/agenda/${c.json.id}`, { ...c.json, concluido: true });
    expect(up.json).toMatchObject({ concluido: true, criadoEm: c.json.criadoEm });
    expect((await chamar("DELETE", `/agenda/${c.json.id}`)).status).toBe(200);
    expect((await chamar("DELETE", `/agenda/${c.json.id}`)).status).toBe(404);
  });

  it("documentos: guia do PROJUDI salva e a agenda só aceita link de incorporação do Google", async () => {
    expect((await chamar("PUT", "/gabinete/documentos/guia_projudi", { texto: "1. Conclusos para sentença: movimento 51." })).status).toBe(200);
    expect((await chamar("GET", "/gabinete/documentos/guia_projudi")).json.texto).toContain("movimento 51");
    expect((await chamar("PUT", "/gabinete/documentos/agenda_config", { texto: "https://exemplo.com/x" })).status).toBe(400);
    expect((await chamar("PUT", "/gabinete/documentos/agenda_config", { texto: "https://calendar.google.com/calendar/embed?src=abc" })).status).toBe(200);
    expect((await chamar("GET", "/gabinete/documentos/outra")).status).toBe(404);
  });

  it("convites: registra, recusa duplicado de membro e revoga", async () => {
    const c = await chamar("POST", "/gabinete/convites", { email: "Pessoa@Exemplo.com", role: "assessor" });
    expect(c.json.email).toBe("pessoa@exemplo.com");
    expect((await chamar("GET", "/gabinete/equipe")).json.convites).toHaveLength(1);
    expect((await chamar("DELETE", "/gabinete/convites/pessoa%40exemplo.com")).status).toBe(200);
    expect((await chamar("GET", "/gabinete/equipe")).json.convites).toHaveLength(0);
  });

  it("minutas: rejeita autos vazios antes de chamar a IA", async () => {
    const r = await chamar("POST", "/minutas", { autos: "curto" });
    expect(r.status).toBe(400);
  });
});
