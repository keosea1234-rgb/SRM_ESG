import { Link } from "react-router-dom";
import type { AlertItem } from "../services/alerts";

function severityDotClass(severity: AlertItem["severity"]) {
  if (severity === "high") return "bg-red-500";
  if (severity === "medium") return "bg-amber-500";
  return "bg-blue-400";
}

function formatAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AlertsDropdown({
  alerts,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: {
  alerts: AlertItem[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-[380px] bg-white border border-surface-200 rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-surface-900">Alerts</p>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={alerts.length === 0}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:text-surface-300"
        >
          Mark all read
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading && (
          <div className="px-4 py-6 text-sm text-surface-500">Loading alerts...</div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="px-4 py-6 text-sm text-surface-500">No unread alerts.</div>
        )}

        {!loading &&
          alerts.map((alert) => (
            <div key={alert.id} className="px-4 py-3 border-b border-surface-100 last:border-b-0">
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 rounded-full ${severityDotClass(alert.severity)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-surface-600">{alert.message}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-surface-400">
                    {alert.supplier_id ? (
                      <Link
                        to={`/suppliers/${alert.supplier_id}`}
                        className="text-brand-600 hover:underline"
                        onClick={onClose}
                      >
                        {alert.supplier_name ?? "View supplier"}
                      </Link>
                    ) : (
                      <span>{alert.supplier_name ?? "Supplier"}</span>
                    )}
                    <span>•</span>
                    <span>{formatAgo(alert.created_at)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onMarkRead(alert.id)}
                  className="text-[11px] text-surface-500 hover:text-surface-700"
                >
                  Read
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
