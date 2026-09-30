import { custoUsd, type Funcionalidade } from "../../shared/pricing.js";
import type { GenerateResult } from "../ai/types.js";
import type { AuthUser } from "../middleware/requireAuth.js";
import { repo } from "../repositories/index.js";

export async function registrarUso(user: AuthUser, funcionalidade: Funcionalidade, r: GenerateResult): Promise<void> {
  const { usd, economiaUsd, tabelado } = custoUsd(r.model, r);
  try {
    await repo().uso.registrar({
      tenantId: user.tenantId,
      uid: user.uid,
      funcionalidade,
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheLeitura: r.cacheLeitura,
      cacheEscrita: r.cacheEscrita,
      buscasWeb: r.buscasWeb,
      usd,
      economiaUsd,
      tabelado,
      em: Date.now(),
    });
  } catch (err) {
    // Falha de telemetria nunca derruba a entrega da minuta.
    console.error("[uso] falha ao registrar consumo", err);
  }
}
