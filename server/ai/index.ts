import { env } from "../config/env.js";
import { Orchestrator } from "./orchestrator.js";
import { anthropicProvider } from "./providers/anthropic.js";
import { geminiProvider } from "./providers/gemini.js";
import { openaiProvider } from "./providers/openai.js";

export const orchestrator = new Orchestrator(
  { gemini: geminiProvider, anthropic: anthropicProvider, openai: openaiProvider },
  { order: env.ai.order, keys: env.ai.keys, models: env.ai.models, maxRetries: env.ai.maxRetries, baseDelayMs: env.ai.baseDelayMs },
);
