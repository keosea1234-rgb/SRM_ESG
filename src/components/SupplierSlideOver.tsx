import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { fetchSupplierESG } from "../services/suppliers";
import type { SupplierSummary } from "../types";

export interface SupplierSlideOverProps {
  supplier: SupplierSummary | null;
  onClose: () => void;
}

const statusBadgeClass: Record<string, string> = {
  active: "badge-active",
  inactive: "badge-inactive",
  blacklisted: "badge-blacklisted",
  pending: "badge-pending",
};

const statusLabel: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
  pending: "Pending",
};

const riskBadgeClass: Record<string, string> = {
  low: "risk-low",
  medium: "risk-medium",
  high: "risk-high",
  critical: "risk-critical",
};

const riskLabel: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function scoreTierPillClasses(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 border border-emerald-300";
  if (score >= 60) return "bg-brand-100 text-brand-800 border border-brand-300";
  if (score >= 40) return "bg-amber-100 text-amber-800 border border-amber-300";
  return "bg-red-100 text-red-800 border border-red-300";
}

export default function SupplierSlideOver({ supplier, onClose }: SupplierSlideOverProps) {
  const { data: esgData, isLoading: esgLoading } = useQuery({
    queryKey: queryKeys.supplierESG(supplier?.id ?? ""),
    queryFn: () => fetchSupplierESG(supplier!.id),
    enabled: supplier !== null,
    staleTime: 1000 * 60 * 5,
  });

  if (supplier == null) return null;

  const statusKey = supplier.status ?? "";
  const statusCls = statusBadgeClass[statusKey] ?? "";
  const statusText = (statusLabel[statusKey] ?? statusKey) || "—";

  const perf = supplier.latest_performance_score;
  const riskKey = supplier.current_risk_level;
  const esgScore = esgData?.overall_esg_score;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div
        key={supplier.id}
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in"
      >
        <div className="border-b border-surface-100 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-3">
            <p className="text-base font-semibold text-surface-900 truncate">{supplier.name}</p>
            {statusKey ? (
              <span className={`badge mt-1 ${statusCls}`}>{statusText}</span>
            ) : (
              <span className="badge mt-1 badge-inactive">—</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-surface-400 hover:text-surface-700 p-1 rounded-lg shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-surface-100 space-y-1 shrink-0">
          <p className="text-sm text-surface-600">{supplier.industry ?? "—"}</p>
          <p className="text-sm text-surface-600">
            {supplier.city && supplier.country
              ? `${supplier.city}, ${supplier.country}`
              : (supplier.city ?? supplier.country ?? "—")}
          </p>
        </div>

        <div className="px-5 py-4 border-b border-surface-100 shrink-0 flex-1 min-h-0">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Health Snapshot</p>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-surface-600">Performance</span>
            {perf != null ? (
              <span
                className={`inline-flex items-center justify-center w-14 py-1 rounded-lg text-sm font-bold tabular-nums ${scoreTierPillClasses(
                  perf
                )}`}
              >
                {perf.toFixed(1)}
              </span>
            ) : (
              <span className="text-sm text-surface-400">—</span>
            )}
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-surface-600">Risk</span>
            {riskKey ? (
              <span className={`badge ${riskBadgeClass[riskKey] ?? "risk-medium"}`}>
                {riskLabel[riskKey] ?? riskKey}
              </span>
            ) : (
              <span className="text-sm text-surface-400">—</span>
            )}
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-surface-600">ESG</span>
            {esgLoading ? (
              <span className="inline-block h-6 w-14 rounded-lg bg-surface-100 animate-pulse" aria-hidden />
            ) : esgScore != null && !Number.isNaN(Number(esgScore)) ? (
              <span
                className={`inline-flex items-center justify-center w-14 py-1 rounded-lg text-sm font-bold tabular-nums ${scoreTierPillClasses(
                  Number(esgScore)
                )}`}
              >
                {Number(esgScore).toFixed(1)}
              </span>
            ) : (
              <span className="text-sm text-surface-400">—</span>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-surface-100 mt-auto shrink-0">
          <Link
            to={`/suppliers/${supplier.id}`}
            className="btn-primary w-full text-center block"
            onClick={onClose}
          >
            View Full Profile →
          </Link>
        </div>
      </div>
    </>
  );
}
