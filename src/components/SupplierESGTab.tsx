// src/components/SupplierESGTab.tsx
// Shows ESG assessment history for a single supplier.
// Used inside SupplierDetail as the "ESG" tab.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import ESGScoreRing from "./ESGScoreRing";
import { Leaf, ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchEsgHistory, type EsgHistoryItem } from "../services/esg";

interface EsgAssessment {
  id: string;
  period: string;
  assessment_date: string;
  status: "draft" | "submitted" | "approved";
  overall_esg_score: number | null;
  env_score: number | null;
  social_score: number | null;
  gov_score: number | null;
  renewable_energy_pct: number | null;
  waste_recycling_pct: number | null;
  carbon_footprint_tons: number | null;
  women_in_mgmt_pct: number | null;
  living_wage_compliant: boolean | null;
  anti_corruption_policy: boolean | null;
  independent_audit: boolean | null;
  gdpr_compliant: boolean | null;
  data_breach_incidents: number | null;
  env_certifications: string[];
  social_certifications: string[];
  gov_certifications: string[];
  notes: string | null;
}

function fmt(val: number | null, unit = ""): string {
  if (val == null) return "—";
  return `${val}${unit}`;
}

function bool(val: boolean | null): string {
  if (val == null) return "—";
  return val ? "Yes" : "No";
}

function statusBadge(status: string) {
  const cfg: Record<string, string> = {
    approved:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    submitted: "bg-brand-50 text-brand-700 border-brand-200",
    draft:     "bg-surface-100 text-surface-600 border-surface-200",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg[status] ?? cfg.draft}`}>
      {status}
    </span>
  );
}

interface Props {
  supplierId: string;
}

export default function SupplierESGTab({ supplierId }: Props) {
  const [assessment, setAssessment] = useState<EsgAssessment | null>(null);
  const [history, setHistory] = useState<EsgHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiGet<EsgAssessment | null>(`/api/esg/${supplierId}`)
      .then((data) => setAssessment(data))
      .catch(() => setAssessment(null))
      .finally(() => setLoading(false));
  }, [supplierId]);

  useEffect(() => {
    fetchEsgHistory(supplierId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [supplierId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 bg-surface-100 rounded-xl flex items-center justify-center">
          <Leaf className="w-6 h-6 text-surface-400" />
        </div>
        <p className="text-sm text-surface-500">No ESG assessment for this supplier yet.</p>
        <button
          onClick={() => navigate("/esg")}
          className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline font-medium"
        >
          Go to ESG page to create one <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const allCerts = [
    ...assessment.env_certifications,
    ...assessment.social_certifications,
    ...assessment.gov_certifications,
  ];
  const historyRows = [...history].reverse();
  const latestHistoryId = history.length > 0 ? history[history.length - 1].id : null;

  return (
    <div className="space-y-5 py-2">

      {/* Header row — overall score + status + period */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ESGScoreRing
            score={assessment.overall_esg_score ?? 0}
            size={72}
            strokeWidth={7}
            color="#0f766e"
          />
          <div>
            <p className="text-xl font-bold text-surface-900">
              ESG Score: {assessment.overall_esg_score ?? "—"}
            </p>
            <p className="text-sm text-surface-500 mt-0.5">
              Period: {assessment.period} · {assessment.assessment_date}
            </p>
            <div className="mt-1">{statusBadge(assessment.status)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
            E {assessment.env_score ?? "—"}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
            S {assessment.social_score ?? "—"}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            G {assessment.gov_score ?? "—"}
          </span>
        </div>
      </div>

      {/* Three pillar sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Environmental */}
        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Environmental</p>
          <div className="space-y-1.5">
            {[
              ["Renewable Energy", fmt(assessment.renewable_energy_pct, "%")],
              ["Waste Recycling",  fmt(assessment.waste_recycling_pct, "%")],
              ["Carbon Footprint", fmt(assessment.carbon_footprint_tons, " t")],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-blue-700">{label}</span>
                <span className="font-medium text-blue-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Social */}
        <div className="bg-purple-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">Social</p>
          <div className="space-y-1.5">
            {[
              ["Women in Mgmt",    fmt(assessment.women_in_mgmt_pct, "%")],
              ["Living Wage",      bool(assessment.living_wage_compliant)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-purple-700">{label}</span>
                <span className="font-medium text-purple-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Governance */}
        <div className="bg-amber-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Governance</p>
          <div className="space-y-1.5">
            {[
              ["Anti-Corruption",   bool(assessment.anti_corruption_policy)],
              ["Independent Audit", bool(assessment.independent_audit)],
              ["GDPR Compliant",    bool(assessment.gdpr_compliant)],
              ["Data Breaches",     fmt(assessment.data_breach_incidents)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-amber-700">{label}</span>
                <span className="font-medium text-amber-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {history.length >= 2 && (
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
            ESG Score Trend
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={history}>
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip />
              <Line dataKey="overall_esg_score" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} name="Overall" />
              <Line dataKey="env_score" stroke="#0369a1" strokeWidth={1.5} dot={false} name="E" />
              <Line dataKey="social_score" stroke="#7c3aed" strokeWidth={1.5} dot={false} name="S" />
              <Line dataKey="gov_score" stroke="#b45309" strokeWidth={1.5} dot={false} name="G" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {history.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
            Assessment History
          </p>
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-50 text-surface-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Period</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Overall</th>
                  <th className="px-3 py-2 text-left font-medium">E</th>
                  <th className="px-3 py-2 text-left font-medium">S</th>
                  <th className="px-3 py-2 text-left font-medium">G</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-surface-100 ${item.id === latestHistoryId ? "bg-teal-50" : "bg-white"}`}
                  >
                    <td className="px-3 py-2 text-surface-900">{item.period}</td>
                    <td className="px-3 py-2 text-surface-600">{item.assessment_date}</td>
                    <td className="px-3 py-2 text-surface-900">{item.overall_esg_score ?? "—"}</td>
                    <td className="px-3 py-2 text-surface-900">{item.env_score ?? "—"}</td>
                    <td className="px-3 py-2 text-surface-900">{item.social_score ?? "—"}</td>
                    <td className="px-3 py-2 text-surface-900">{item.gov_score ?? "—"}</td>
                    <td className="px-3 py-2">{statusBadge(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Certifications */}
      {allCerts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-surface-500 mb-2">Certifications</p>
          <div className="flex flex-wrap gap-2">
            {allCerts.map((cert) => (
              <span
                key={cert}
                className="text-xs font-medium px-2.5 py-1 rounded-full bg-surface-100 text-surface-700 border border-surface-200"
              >
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {assessment.notes && (
        <div className="bg-surface-50 rounded-lg px-4 py-3 text-sm text-surface-600">
          <p className="text-xs font-medium text-surface-400 mb-1">Notes</p>
          {assessment.notes}
        </div>
      )}
    </div>
  );
}
