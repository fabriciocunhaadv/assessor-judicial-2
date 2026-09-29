import { env } from "../config/env.js";
import { adminDb } from "../lib/firebaseAdmin.js";
import { createFirestoreRepo } from "./firestore.js";
import { createMemoryRepo } from "./memory.js";
import type { Repositorio } from "./types.js";

let instance: Repositorio | undefined;

export function repo(): Repositorio {
  if (!instance) instance = env.dataBackend === "firestore" ? createFirestoreRepo(adminDb()) : createMemoryRepo();
  return instance;
}

/** Apenas para testes. */
export function setRepo(r: Repositorio) {
  instance = r;
}
