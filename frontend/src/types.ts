// Shared API/response types (match the Flask API exactly).
export type EvidenceKind = "factcheck" | "news";

export interface EvidenceItem {
  fingerprint: string;
  provider: string;
  kind: EvidenceKind;
  title: string;
  url: string;
  snippet: string | null;
  published_at: string | null;
  source: {
    publisher?: string | null;
    domain?: string | null;
    rating?: string | null;
    claimant?: string | null;
    country?: string | null;
    language?: string | null;
  };
}

export interface MlTrack {
  available: boolean;
  reason?: string;
  label?: "REAL" | "FAKE";
  probabilities?: { real: number; fake: number };
  confidence?: number;
  reliability?: "low" | "normal";
  model_version?: string | null;
  trained_at?: string | null;
}

export interface AiBlock {
  available: boolean;
  text: string | null;
  reason: string | null;
}

export type VerdictValue = "supported" | "contradicted" | "mixed" | "insufficient";

export interface EvidenceVerdict {
  available: boolean;
  reason?: string | null;
  verdict?: VerdictValue;
  confidence?: "low" | "medium" | "high";
  reasoning?: string;
  citations?: { index: number; title: string; url: string; fingerprint: string }[];
}

export interface ProviderStatusResult {
  provider: string;
  kind: string;
  status: "ok" | "error" | "skipped" | "cooldown" | "disabled";
  count?: number;
  error?: string;
}

export interface AnalysisResult {
  id: string | null;
  created_at: string;
  persisted: boolean;
  input: { type: "text" | "url"; text: string; url: string | null; source_title: string | null };
  ml_track: MlTrack;
  evidence_verdict: EvidenceVerdict;
  evidence_track: {
    summary: AiBlock;
    items: EvidenceItem[];
    providers_used: string[];
    providers_failed: ProviderStatusResult[];
  };
}

/** Stored analysis row (history detail and shared snapshot share this shape). */
export interface AnalysisDetail {
  id?: string;
  input_type: "text" | "url";
  input_text: string;
  input_url: string | null;
  source_title: string | null;
  ml_available: boolean;
  ml_label: "REAL" | "FAKE" | null;
  ml_probability: number | null;
  ml_features: { reliability?: "low" | "normal" } | null;
  ml_model_version: string | null;
  evidence: EvidenceItem[];
  ai_summary: string | null;
  evidence_verdict?: Omit<EvidenceVerdict, "available"> | null;
  lang?: string;
  providers_used: string[];
  providers_failed: ProviderStatusResult[];
  created_at: string;
}

export type AnalysisListItem = AnalysisDetail & { id: string };

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  analysis_id: string | null;
  evidence_url: string | null;
  evidence_provider: string | null;
  read: boolean;
  created_at: string;
}

export interface ProviderInfo {
  name: string;
  label: string;
  kind: string;
  enabled: boolean;
  requires_key: boolean;
  status: string;
  last_error: string | null;
  last_ok: string | null;
}

export interface CuratedSource {
  name: string;
  url: string;
  region: string;
  type: string;
  description: string;
}

export interface ReadyChecks {
  ok: boolean;
  degraded: boolean;
  checks: {
    supabase_configured: boolean;
    supabase_service_configured: boolean;
    supabase_reachable: boolean;
    model_loaded: boolean;
    model_version: string | null;
    model_error: string | null;
    groq_configured: boolean;
    providers_enabled: number;
  };
}
