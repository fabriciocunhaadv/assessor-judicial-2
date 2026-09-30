import { env } from "../config/env.js";
import { Orchestrator } from "./orchestrator.js";
import { anthropicProvider } from "./providers/anthropic.js";

export const orchestrator = new Orchestrator(anthropicProvider, {
  keys: env.ai.keys,
  models: env.ai.models,
  maxRetries: env.ai.maxRetries,
  baseDelayMs: env.ai.baseDelayMs,
});
