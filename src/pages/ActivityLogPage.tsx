import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { queryKeys } from "../lib/queryKeys";
import { fetchActivityLog, fetchActivityActions, type ActivityLogRow } from "../services/activityLog";
import { pageVariants, staggerContainer, staggerItem } from "../lib/animation";
import { usePageTitle } from "../hooks/usePageTitle";

const PAGE_SIZE = 20;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-50 text-green-700 border border-green-200",
  updated: "bg-blue-50 text-blue-700 border border-blue-200",
  deleted: "bg-red-50 text-red-700 border border-red-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  uploaded: "bg-purple-50 text-purple-700 border border-purple-200",
};

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return null;
  const style = ACTION_COLORS[action.toLowerCase()] ?? "bg-surface-100 text-surface-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs capitalize ${style}`}>
      {action}
    </span>
  );
}

export default function ActivityLogPage() {
  usePageTitle("Audit Log");
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const activityFilters = {
    page,
    limit: PAGE_SIZE,
    action: actionFilter,
  };

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.activityLog(activityFilters),
    queryFn: () =>
      fetchActivityLog({
        page,
        limit: PAGE_SIZE,
        action: actionFilter || undefined,
      }),
  });

  const { data: actionsData } = useQuery({
    queryKey: queryKeys.activityActions(),
    queryFn: fetchActivityActions,
    staleTime: Infinity,
  });

  const actions = actionsData ?? [];

  const rows: ActivityLogRow[] = data?.data ?? [];
  const total = data?.pagination.total ?? 0;

  const error =
    queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-surface-900">Activity Log</h1>
            <p className="text-sm text-surface-500">Full audit trail — {total} entries</p>
          </div>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-surface-200 rounded-lg px-3 py-2 text-surface-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-surface-500">No activity yet.</p>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    When
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Entity
                  </th>
                </tr>
              </thead>
              <motion.tbody
                className="divide-y divide-surface-100"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                key={`${page}-${actionFilter}`}
              >
                {rows.map((r) => (
                  <motion.tr key={r.id} variants={staggerItem} className="hover:bg-surface-50/50 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="text-sm text-surface-900">{timeAgo(r.performed_at)}</p>
                      <p className="text-xs text-surface-400">{formatDate(r.performed_at)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <ActionBadge action={r.action} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-surface-700">{r.supplier_name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-surface-600 max-w-xs truncate">
                      {r.description ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-surface-400">{r.entity_type ?? "—"}</td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-surface-500">
              <span>
                Page {page} of {totalPages} — {total} total entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-surface-200 disabled:opacity-40 hover:bg-surface-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-surface-200 disabled:opacity-40 hover:bg-surface-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
