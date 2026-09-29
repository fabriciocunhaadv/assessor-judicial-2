import { assertSafeConfig, env } from "./config/env.js";
import { createApp } from "./app.js";
import { orchestrator } from "./ai/index.js";

assertSafeConfig();
const server = createApp().listen(env.port, () => {
  const cascata = orchestrator.configured();
  console.log(`[assessor-judicial] API em http://localhost:${env.port} · dados: ${env.dataBackend} · auth: ${env.authDisabled ? "DESATIVADA (dev)" : "Firebase"}`);
  console.log(`[assessor-judicial] cascata de IA: ${cascata.map((c) => `${c.provider}[${c.models.join(" → ")}; ${c.keys} chave(s)]`).join(" ⇒ ") || "NENHUM provedor configurado"}`);
});
// Minutas longas podem levar minutos.
server.requestTimeout = env.ai.timeoutMs + 60_000;
server.headersTimeout = env.ai.timeoutMs + 65_000;
