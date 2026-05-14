import { getAuthToken } from "./supabase";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  if (!token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Unwraps { ok: true, data: ... } and { data: [], pagination: {} } envelopes.
function unwrap<T>(json: any): T {
  if (json && typeof json === "object" && "ok" in json && "data" in json) {
    return json.data as T;
  }
  if (json && typeof json === "object" && "data" in json && "pagination" in json) {
    return json.data as T;
  }
  return json as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return unwrap<T>(await res.json());
}

/** Full JSON body without unwrapping `{ ok, data }` or `{ data, pagination }` envelopes. */
export async function apiGetRaw<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return unwrap<T>(await res.json());
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return unwrap<T>(await res.json());
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
