import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  FileText, Search, Filter, ExternalLink,
  Calendar, DollarSign, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";
import { queryKeys } from "../lib/queryKeys";
import { fetchContracts, type Contract, type ContractsPagination } from "../services/contracts";
import { pageVariants, staggerContainer, staggerItem } from "../lib/animation";
import { EmptyValue } from "../components/ui/EmptyValue";
import { usePageTitle } from "../hooks/usePageTitle";

const statusConfig: Record<string, { label: string; className: string }> = {
  Draft:    { label: "Draft",    className: "bg-surface-100 text-surface-600 border border-surface-200" },
  Review:   { label: "Review",   className: "bg-amber-50 text-amber-700 border border-amber-200" },
  Active:   { label: "Active",   className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  Expired:  { label: "Expired",  className: "bg-red-50 text-red-700 border border-red-200" },
  Archived: { label: "Archived", className: "bg-surface-100 text-surface-500 border border-surface-200" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const chipRed =
  "inline-flex items-center text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1";
const chipAmber =
  "inline-flex items-center text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1";

/** Uses daysUntil() so ≤30d / 31–90d / far / expired read differently at a glance. */
function ExpirationUrgency({ expirationDate }: { expirationDate: string | null }) {
  if (!expirationDate) {
    return <EmptyValue />;
  }
  const days = daysUntil(expirationDate);
  if (days == null) {
    return <span className="text-xs text-surface-400">—</span>;
  }
  if (days < 0) {
    return <span className={chipRed}>Expired {Math.abs(days)}d ago</span>;
  }
  if (days <= 30) {
    return <span className={chipRed}>Expires in {days}d</span>;
  }
  if (days <= 90) {
    return <span className={chipAmber}>Expires in {days}d</span>;
  }
  return <span className="text-xs text-surface-600 tabular-nums">{formatDate(expirationDate)}</span>;
}

export default function ContractsPage() {
  usePageTitle("Contracts");
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const [statusFilter, setStatusFilter] = useState("all");

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.contracts({
      page: currentPage,
      search: debouncedSearch,
      status: statusFilter,
    }),
    queryFn: () =>
      fetchContracts({
        page: currentPage,
        search: debouncedSearch,
        status: statusFilter,
      }),
  });

  const contracts: Contract[] = !data
    ? []
    : Array.isArray(data)
      ? data
      : (data.data ?? []);

  const pagination: ContractsPagination = !data
    ? { total: 0, page: 1, limit: 20, totalPages: 0 }
    : Array.isArray(data)
      ? { total: data.length, page: 1, limit: data.length, totalPages: 1 }
      : (data.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 0 });

  const error =
    queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div>
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-full mt-2 rounded" />
        </div>
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-10 flex-1 min-w-[240px] rounded-lg" />
            <Skeleton className="h-10 w-44 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-full max-w-[180px] rounded" />
                    <Skeleton className="h-3 w-28 rounded" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-full shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-full rounded" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-surface-100 mt-auto gap-2">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-3 w-36 rounded shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error)
    return (
      <div className="text-center py-24">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={() => void refetch()} className="btn-secondary mt-4">
          Retry
        </button>
      </div>
    );

  return (
    <motion.div
      className="space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div>
        <h1 className="font-display text-2xl font-semibold text-surface-900">Contracts</h1>
        <p className="text-sm text-surface-500 mt-1">{pagination.total} contracts from ContractGuard</p>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input type="text" placeholder="Search by title or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-surface-400" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto pr-8">
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Review">Review</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        key={`${debouncedSearch}-${statusFilter}-${currentPage}`}
      >
        {contracts.map((c) => {
          return (
            <motion.div
              key={c.id}
              variants={staggerItem}
              className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              whileHover={{ y: -2 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-900 truncate">{c.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{c.supplier_name || "No supplier"}</p>
                  </div>
                </div>
                <span className={`badge flex-shrink-0 ${statusConfig[c.status]?.className || "bg-surface-100 text-surface-600"}`}>
                  {statusConfig[c.status]?.label || c.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-surface-500"><Calendar className="w-3 h-3" /><span>{formatDate(c.start_date)}</span></div>
                <div className="flex items-center gap-1.5 text-surface-500"><DollarSign className="w-3 h-3" /><span>{formatCurrency(c.contract_size)}</span></div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {c.contract_type && <span className="text-xs bg-surface-100 text-surface-600 px-2 py-0.5 rounded">{c.contract_type}</span>}
                {c.category && <span className="text-xs bg-surface-100 text-surface-600 px-2 py-0.5 rounded">{c.category}</span>}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-surface-100 mt-auto gap-2">
                <ExpirationUrgency expirationDate={c.expiration_date} />
                <button className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"><ExternalLink className="w-3 h-3" />Open in ContractGuard</button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {contracts.length === 0 && <div className="card p-12 text-center"><p className="text-sm text-surface-400">No contracts found.</p></div>}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-surface-500">
          <span>Page {currentPage} of {pagination.totalPages} — {pagination.total} total</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-surface-200 disabled:opacity-40 hover:bg-surface-50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={currentPage === pagination.totalPages} className="p-1.5 rounded-lg border border-surface-200 disabled:opacity-40 hover:bg-surface-50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
