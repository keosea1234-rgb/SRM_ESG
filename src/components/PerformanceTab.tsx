import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiGet, apiPost } from "../lib/api";

interface PerformanceEvaluation {
  id: string;
  evaluation_period: string;
  quality_score: number;
  delivery_score: number;
  price_score: number;
  communication_score: number;
  overall_score: number;
  notes?: string | null;
}

interface PerformanceTabProps {
  supplierId: string;
}

function overallScoreBadgeClass(score: number): string {
  if (score >= 7) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (score >= 4) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-red-50 text-red-700 border border-red-200";
}

export default function PerformanceTab({ supplierId }: PerformanceTabProps) {
  const [evaluations, setEvaluations] = useState<PerformanceEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  const [evalYear, setEvalYear] = useState(currentYear);
  const [evalQuarter, setEvalQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4">("Q1");
  const evaluationPeriod = `${evalYear}-${evalQuarter}`;
  const [qualityScore, setQualityScore] = useState(7);
  const [deliveryScore, setDeliveryScore] = useState(7);
  const [priceScore, setPriceScore] = useState(7);
  const [communicationScore, setCommunicationScore] = useState(7);
  const [qualityWeight, setQualityWeight] = useState(0.3);
  const [deliveryWeight, setDeliveryWeight] = useState(0.25);
  const [priceWeight, setPriceWeight] = useState(0.25);
  const [communicationWeight, setCommunicationWeight] = useState(0.2);
  const [notes, setNotes] = useState("");

  const weightSum = qualityWeight + deliveryWeight + priceWeight + communicationWeight;
  const weightsValid = Math.abs(weightSum - 1) <= 0.01;

  const weightedPreview = useMemo(() => {
    return (
      qualityScore * qualityWeight +
      deliveryScore * deliveryWeight +
      priceScore * priceWeight +
      communicationScore * communicationWeight
    );
  }, [
    qualityScore,
    deliveryScore,
    priceScore,
    communicationScore,
    qualityWeight,
    deliveryWeight,
    priceWeight,
    communicationWeight,
  ]);

  const loadEvaluations = useCallback(async () => {
    if (!supplierId) return;
    try {
      setLoading(true);
      setError(null);
      setEvaluations(await apiGet<PerformanceEvaluation[]>(`/api/suppliers/${supplierId}/evaluations`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load evaluations");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void loadEvaluations();
  }, [loadEvaluations]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !evaluationPeriod.trim() || !weightsValid) return;
    try {
      setSubmitting(true);
      setError(null);
      await apiPost(`/api/suppliers/${supplierId}/evaluations`, {
        evaluation_period: evaluationPeriod.trim(),
        quality_score: qualityScore,
        delivery_score: deliveryScore,
        price_score: priceScore,
        communication_score: communicationScore,
        quality_weight: qualityWeight,
        delivery_weight: deliveryWeight,
        price_weight: priceWeight,
        communication_weight: communicationWeight,
        notes: notes.trim() || undefined,
      });
      setShowForm(false);
      setEvalYear(currentYear);
      setEvalQuarter("Q1");
      setNotes("");
      setQualityScore(7);
      setDeliveryScore(7);
      setPriceScore(7);
      setCommunicationScore(7);
      setQualityWeight(0.3);
      setDeliveryWeight(0.25);
      setPriceWeight(0.25);
      setCommunicationWeight(0.2);
      await loadEvaluations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create evaluation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-surface-900">Performance evaluations</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Evaluation
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="font-display text-base font-semibold text-surface-900">New evaluation</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <span className="text-sm text-surface-600">Evaluation period</span>
              <div className="flex gap-2">
                <select
                  className="input-field w-32"
                  value={evalYear}
                  onChange={(e) => setEvalYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  className="input-field w-24"
                  value={evalQuarter}
                  onChange={(e) => setEvalQuarter(e.target.value as "Q1" | "Q2" | "Q3" | "Q4")}
                >
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
                <div className="input-field w-28 flex items-center text-sm text-surface-500 bg-surface-50">
                  {evaluationPeriod}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  ["Quality", qualityScore, setQualityScore],
                  ["Delivery", deliveryScore, setDeliveryScore],
                  ["Price", priceScore, setPriceScore],
                  ["Communication", communicationScore, setCommunicationScore],
                ] as const
              ).map(([label, value, setVal]) => (
                <label key={label} className="block space-y-1">
                  <div className="flex justify-between text-sm text-surface-600">
                    <span>{label}</span>
                    <span className="font-medium text-surface-900">{value}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    className="w-full accent-brand-600"
                    value={value}
                    onChange={(e) => setVal(Number(e.target.value))}
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-surface-500">Quality weight</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  className="input-field h-9"
                  value={qualityWeight}
                  onChange={(e) => setQualityWeight(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-surface-500">Delivery weight</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  className="input-field h-9"
                  value={deliveryWeight}
                  onChange={(e) => setDeliveryWeight(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-surface-500">Price weight</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  className="input-field h-9"
                  value={priceWeight}
                  onChange={(e) => setPriceWeight(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-surface-500">Communication weight</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  className="input-field h-9"
                  value={communicationWeight}
                  onChange={(e) => setCommunicationWeight(Number(e.target.value))}
                />
              </label>
            </div>

            {!weightsValid && (
              <p className="text-sm text-red-600">
                Weights must sum to 1.00 — current sum is {weightSum.toFixed(2)}
              </p>
            )}

            <div className="rounded-lg border border-surface-200 bg-surface-50/80 px-4 py-3 text-sm text-surface-800">
              <span className="text-surface-500">Weighted score preview: </span>
              <span className="font-semibold text-brand-700">{weightedPreview.toFixed(2)}</span>
            </div>

            <label className="block space-y-1">
              <span className="text-sm text-surface-600">Notes (optional)</span>
              <textarea
                className="input-field min-h-[88px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !evaluationPeriod.trim() || !weightsValid}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Submit evaluation"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-surface-500 text-sm py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading evaluations…
        </div>
      ) : evaluations.length === 0 ? (
        <p className="text-sm text-surface-500">No evaluations yet.</p>
      ) : (
        <div className="space-y-6">
          {evaluations.length >= 2 && (
            <div className="card p-5">
              <h3 className="font-display text-sm font-semibold text-surface-700 mb-4">Overall Score Trend</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart
                  data={[...evaluations].reverse().map((ev) => ({
                    period: ev.evaluation_period,
                    score: Number(ev.overall_score?.toFixed(2)),
                  }))}
                  margin={{ top: 4, right: 16, left: -16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number) => [value.toFixed(2), "Overall Score"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#2563eb" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-3">
          {evaluations.map((ev) => (
            <div key={ev.id} className="card p-4 border border-surface-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-surface-900">{ev.evaluation_period}</span>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${overallScoreBadgeClass(
                    ev.overall_score
                  )}`}
                >
                  Overall: {ev.overall_score?.toFixed?.(2) ?? ev.overall_score}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-surface-600">
                <span>Q: {ev.quality_score}</span>
                <span>D: {ev.delivery_score}</span>
                <span>P: {ev.price_score}</span>
                <span>C: {ev.communication_score}</span>
              </div>
              {ev.notes && <p className="text-xs text-surface-500 mt-2 border-t border-surface-100 pt-2">{ev.notes}</p>}
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
