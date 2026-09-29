import { auth } from "./firebase";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function headers(json: boolean): Promise<HeadersInit> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  const token = await auth?.currentUser?.getIdToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.erro ?? `Erro ${res.status}`, body.detalhes);
  return body as T;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return handle<T>(await fetch(`/api${path}`, { headers: await headers(false) }));
  },
  async post<T>(path: string, body: unknown, method: "POST" | "PUT" = "POST"): Promise<T> {
    return handle<T>(await fetch(`/api${path}`, { method, headers: await headers(true), body: JSON.stringify(body) }));
  },
  async upload<T>(path: string, file: File): Promise<T> {
    const fd = new FormData();
    fd.append("arquivo", file);
    return handle<T>(await fetch(`/api${path}`, { method: "POST", headers: await headers(false), body: fd }));
  },
};
