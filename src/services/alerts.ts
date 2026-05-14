import { apiGet, apiPatch } from "../lib/api";

export type AlertSeverity = "high" | "medium" | "low";
export type AlertType =
  | "esg_threshold_crossed"
  | "cert_expiring"
  | "risk_spike"
  | "performance_drop"
  | "missing_compliance_doc"
  | "supplier_inactivity";

export interface AlertItem {
  id: string;
  supplier_id: string | null;
  supplier_name?: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  resolved_at: string | null;
}

export async function fetchAlerts(limit = 10): Promise<AlertItem[]> {
  return apiGet<AlertItem[]>(`/api/alerts?limit=${limit}`);
}

export async function markAlertRead(alertId: string): Promise<void> {
  await apiPatch(`/api/alerts/${alertId}/read`, {});
}
