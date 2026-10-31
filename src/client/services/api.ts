import { enqueue } from "../offline.js";
import type { QueuedResult } from "../types.js";

export const isQueued = (value: unknown): value is QueuedResult => Boolean(value && typeof value === "object" && "queued" in value);
export const api = async <T = Record<string, unknown>,>(path: string, options?: RequestInit, queueOnNetworkError = true): Promise<T | QueuedResult> => {
  const request = { headers: { "Content-Type": "application/json", "x-user-id": localStorage.getItem("userId") || "" }, ...options };
  let response: Response;
  try { response = await fetch(`/api${path}`, request); }
  catch (error) {
    if (queueOnNetworkError && options?.method && options.method !== "GET") { enqueue({ path, options: request }); return { queued: true }; }
    throw error;
  }
  const body = await response.text();
  let data: { error?: string; [key: string]: unknown } = {};
  if (body) {
    try { data = JSON.parse(body) as typeof data; }
    catch { throw new Error(`Respuesta inválida del servidor (${response.status})`); }
  }
  if (!response.ok) throw new Error(data.error || "Error de API");
  return data as T;
};
