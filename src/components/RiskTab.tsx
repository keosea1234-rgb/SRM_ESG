import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";

interface RiskAssessment {
  id: string;
  assessment_date: string;
  financial_risk: number;
  operational_risk: number;
  compliance_risk: number;
  geopolitical_risk: number;
  reputational_risk: number;
  overall_risk_level: string;
  notes?: string | null;
}

interface RiskTabProps {
  supplierId: string;
}

const RISK_DIMENSIONS: { key: keyof Pick<
  RiskAssessment,
  "financial_risk" | "operational_risk" | "compliance_risk" | "geopolitical_risk" | "reputational_risk"
>; label: string }[] = [
  { key: "financial_risk", label: "Financial" },
  { key: "operational_risk", label: "Operational" },
  { key: "compliance_risk", label: "Compliance" },
  { key: "geopolitical_risk", label: "Geopolitical" },
  { key: "reputational_risk", label: "Reputational" },
];

function scoreButtonClass(value: number, selected: number): string {
  const base =
    "min-w-[2.25rem] h-9 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50";
  const isSel = value === selected;
  const ring = isSel ? " ring-2 ring-brand-500 ring-offset-1" : "";
  if (value <= 2) return `${base} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100${ring}`;
  if (value === 3) return `${base} border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100${ring}`;
  return `${base} border-red-200 bg-red-50 text-red-800 hover:bg-red-100${ring}`;
}

function barColorClass(score: number): string {
  if (score <= 2) return "bg-emerald-500";
  if (score === 3) return "bg-amber-500";
  return "bg-red-500";
}

function previewLevelFromAverage(avg: number): string {
  if (avg >= 4) return "Critical";
  if (avg >= 3) return "High";
  if (avg >= 2) return "Medium";
  return "Low";
}

function previewBadgeClass(level: string): string {
  if (level === "Critical") return "bg-red-50 text-red-800 border border-red-200";
  if (level === "High") return "bg-amber-50 text-amber-900 border border-amber-200";
  if (level === "Medium") return "bg-amber-50/80 text-amber-800 border border-amber-100";
  return "bg-emerald-50 text-emerald-800 border border-emerald-200";
}

function levelBadgeFromApi(level: string): string {
  const l = level.toLowerCase();
  if (l.includes("critical") || l.includes("very high")) return "bg-red-50 text-red-800 border border-red-200";
  if (l.includes("high")) return "bg-amber-50 text-amber-900 border border-amber-200";
  if (l.includes("medium") || l.includes("moderate")) return "bg-amber-50/80 text-amber-800 border border-amber-100";
  if (l.includes("low")) return "bg-emerald-50 text-emerald-800 border border-emerald-200";
  return "bg-surface-100 text-surface-700 border border-surface-200";
}

export default function RiskTab({ supplierId }: RiskTabProps) {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [financial, setFinancial] = useState(3);
  const [operational, setOperational] = useState(3);
  const [compliance, setCompliance] = useState(3);
  const [geopolitical, setGeopolitical] = useState(3);
  const [reputational, setReputational] = useState(3);
  const [mitigationNotes, setMitigationNotes] = useState("");

  const setters: Record<
    (typeof RISK_DIMENSIONS)[number]["key"],
    (n: number) => void
  > = {
    financial_risk: setFinancial,
    operational_risk: setOperational,
    compliance_risk: setCompliance,
    geopolitical_risk: setGeopolitical,
    reputational_risk: setReputational,
  };

  const values: Record<(typeof RISK_DIMENSIONS)[number]["key"], number> = {
    financial_risk: financial,
    operational_risk: operational,
    compliance_risk: compliance,
    geopolitical_risk: geopolitical,
    reputational_risk: reputational,
  };

  const avgPreview = useMemo(() => {
    return (financial + operational + compliance + geopolitical + reputational) / 5;
  }, [financial, operational, compliance, geopolitical, reputational]);

  const previewLevel = useMemo(() => previewLevelFromAverage(avgPreview), [avgPreview]);

  const loadAssessments = useCallback(async () => {
    if (!supplierId) return;
    try {
      setLoading(true);
      setError(null);
      setAssessments(await apiGet<RiskAssessment[]>(`/api/risk/suppliers/${supplierId}/assessments`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assessments");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) return;
    try {
      setSubmitting(true);
      setError(null);
      await apiPost(`/api/risk/suppliers/${supplierId}/assessments`, {
        financial_risk: financial,
        operational_risk: operational,
        compliance_risk: compliance,
        geopolitical_risk: geopolitical,
        reputational_risk: reputational,
        notes: mitigationNotes.trim() || undefined,
      });
      setShowForm(false);
      setMitigationNotes("");
      setFinancial(3);
      setOperational(3);
      setCompliance(3);
      setGeopolitical(3);
      setReputational(3);
      await loadAssessments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create assessment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-surface-900">Risk assessments</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Assessment
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="font-display text-base font-semibold text-surface-900">New assessment</h3>
          <p className="text-xs text-surface-500">1 = Very low · 5 = Critical</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {RISK_DIMENSIONS.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <span className="text-sm font-medium text-surface-700">{label}</span>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={scoreButtonClass(n, values[key])}
                      onClick={() => setters[key](n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-surface-200 bg-surface-50/80 px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-surface-500">Preview (avg {avgPreview.toFixed(2)}):</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${previewBadgeClass(previewLevel)}`}>
                {previewLevel}
              </span>
            </div>

            <label className="block space-y-1">
              <span className="text-sm text-surface-600">Mitigation notes (optional)</span>
              <textarea
                className="input-field min-h-[88px]"
                value={mitigationNotes}
                onChange={(e) => setMitigationNotes(e.target.value)}
                rows={3}
              />
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                {submitting ? "Saving…" : "Submit assessment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-surface-500 text-sm py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading assessments…
        </div>
      ) : assessments.length === 0 ? (
        <p className="text-sm text-surface-500">No assessments yet.</p>
      ) : (
        <div className="space-y-3">
          {[...assessments].reverse().map((a, idx, arr) => {
            const prev = arr[idx - 1];
            const LEVEL_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
            const currLevel = LEVEL_ORDER[a.overall_risk_level?.toLowerCase()] ?? 0;
            const prevLevel = prev ? (LEVEL_ORDER[prev.overall_risk_level?.toLowerCase()] ?? 0) : null;
            const movement = prevLevel === null ? null : currLevel > prevLevel ? "worse" : currLevel < prevLevel ? "better" : "same";
            return (
            <div key={a.id} className="card p-4 border border-surface-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-surface-600">
                    {new Date(a.assessment_date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {movement === "worse" && <span className="text-xs font-semibold text-red-600">↑ Worsened</span>}
                  {movement === "better" && <span className="text-xs font-semibold text-emerald-600">↓ Improved</span>}
                  {movement === "same" && <span className="text-xs font-semibold text-surface-400">→ Unchanged</span>}
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${levelBadgeFromApi(
                    a.overall_risk_level
                  )}`}
                >
                  {a.overall_risk_level}
                </span>
              </div>
              <div className="space-y-2">
                {RISK_DIMENSIONS.map(({ key, label }) => {
                  const score = a[key] as number;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs text-surface-600">
                        <span>{label}</span>
                        <span className="font-medium text-surface-900">{score}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColorClass(score)}`}
                          style={{ width: `${(score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {a.notes && (
                <p className="text-xs text-surface-500 border-t border-surface-100 pt-2">
                  <span className="font-medium text-surface-600">Mitigation: </span>
                  {a.notes}
                </p>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
