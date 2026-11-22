import { supabase } from "./supabase";
import type {
  AnalysisDetail,
  AnalysisListItem,
  AnalysisResult,
  CuratedSource,
  NotificationItem,
  ProviderInfo,
  ReadyChecks,
} from "@/src/types";

export const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8001"}/api`;

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown; auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.auth !== false) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new ApiError("auth_required", 401, "Sign in to use this feature.");
    }
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const err = payload?.error;
    throw new ApiError(
      err?.code ?? "request_failed",
      response.status,
      err?.message ?? `Request failed with status ${response.status}.`,
    );
  }
  return payload as T;
}

export const api = {
  ready: () => request<ReadyChecks>("/ready", { auth: false }),
  me: () =>
    request<{ user: { id: string; email?: string | null }; retention: { max_history: number; days: number } }>("/me"),
  analyze: (payload: { text?: string; url?: string; lang?: string }) =>
    request<AnalysisResult>("/analyze", { method: "POST", body: payload }),
  analyses: () => request<AnalysisListItem[]>("/analyses?limit=50"),
  analysis: (id: string) => request<AnalysisDetail>(`/analyses/${id}`),
  shareStatus: (id: string) => request<{ shared: boolean; token: string | null }>(`/analyses/${id}/share`),
  createShare: (id: string) => request<{ shared: boolean; token: string }>(`/analyses/${id}/share`, { method: "POST" }),
  deleteShare: (id: string) => request<{ shared: boolean }>(`/analyses/${id}/share`, { method: "DELETE" }),
  shared: (token: string) => request<{ analysis: AnalysisDetail; shared_at: string }>(`/shared/${token}`),
  deleteAnalysis: (id: string) => request<{ ok: boolean }>(`/analyses/${id}`, { method: "DELETE" }),
  clearAnalyses: () => request<{ ok: boolean }>("/analyses", { method: "DELETE" }),
  notifications: () => request<NotificationItem[]>("/notifications"),
  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ ok: boolean }>("/notifications/read_all", { method: "POST" }),
  discover: (query: string, kind: string) =>
    request<{
      query: string;
      items: import("@/src/types").EvidenceItem[];
      providers: import("@/src/types").ProviderStatusResult[];
      retrieved_at: string;
    }>(`/discover?q=${encodeURIComponent(query)}${kind ? `&kind=${kind}` : ""}`),
  sources: () => request<{ sources: CuratedSource[] }>("/sources", { auth: false }),
  providers: () => request<{ providers: ProviderInfo[] }>("/providers"),
};
