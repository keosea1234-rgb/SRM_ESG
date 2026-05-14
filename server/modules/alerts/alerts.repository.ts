import { supabase } from "../../db/supabaseClient";

export type AlertSeverity = "high" | "medium" | "low";
export type AlertType =
  | "esg_threshold_crossed"
  | "cert_expiring"
  | "risk_spike"
  | "performance_drop"
  | "missing_compliance_doc"
  | "supplier_inactivity"
  | "esg_score_decline"
  | "high_risk_assessment"
  | "contract_expiring";

export interface AlertRow {
  id: string;
  supplier_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  resolved_at: string | null;
  supplier_name?: string | null;
}

/** True if an unread alert already exists for this supplier and type (dedupe for snapshot-driven alerts). */
export async function hasUnreadAlert(supplierId: string, alertType: AlertType): Promise<boolean> {
  const { count, error } = await supabase
    .from("srm_alerts")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .eq("alert_type", alertType)
    .eq("is_read", false);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function hasAlertForToday(supplierId: string, alertType: AlertType): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("srm_alerts")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .eq("alert_type", alertType)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lt("created_at", `${today}T23:59:59.999Z`);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function insertAlert(payload: {
  supplier_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("srm_alerts").insert({
    supplier_id: payload.supplier_id,
    alert_type: payload.alert_type,
    severity: payload.severity,
    message: payload.message,
    metadata: payload.metadata ?? {},
  });
  if (error) throw error;
}

export async function getUnreadAlerts(limit = 10): Promise<AlertRow[]> {
  const { data, error } = await supabase
    .from("srm_alerts")
    .select("id, supplier_id, alert_type, severity, message, metadata, is_read, created_at, resolved_at, srm_suppliers(name)")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    supplier_id: row.supplier_id,
    alert_type: row.alert_type,
    severity: row.severity,
    message: row.message,
    metadata: row.metadata ?? {},
    is_read: row.is_read,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    supplier_name: row?.srm_suppliers?.name ?? null,
  }));
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase.from("srm_alerts").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}
