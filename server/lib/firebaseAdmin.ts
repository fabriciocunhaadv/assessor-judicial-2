import { initializeApp, getApps, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../config/env.js";

let app: App | undefined;

export function adminApp(): App {
  if (!app) {
    app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: env.firebaseProjectId });
  }
  return app;
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
