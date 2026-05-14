import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { fetchAlerts, markAlertRead } from "../services/alerts";
import AlertsDropdown from "./AlertsDropdown";
import { Search, Bell, ChevronDown, LogOut, User, Building2 } from "lucide-react";

interface SearchResult {
  id: string;
  name: string;
  status: string;
  industry: string | null;
  current_risk_level: string | null;
}

const riskColor: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

export default function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  // ── Search state ─────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  /** Keyboard highlight in supplier list (-1 = none). */
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const selectedIndexRef = useRef(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const resultItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const alertsRef = useRef<HTMLDivElement>(null);

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: queryKeys.alerts(10),
    queryFn: () => fetchAlerts(10),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markAlertRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts(10) });
    },
  });

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  // Debounced search — fires 300ms after user stops typing
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiGet<any>(
          `/api/suppliers?search=${encodeURIComponent(query.trim())}&limit=6`
        );
        // Handle both array and paginated response
        const list: SearchResult[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : [];
        setResults(list);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  useEffect(() => {
    if (selectedIndex < 0 || !showResults) return;
    resultItemRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedIndex, showResults]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(supplier: SearchResult) {
    setQuery("");
    setShowResults(false);
    setSelectedIndex(-1);
    navigate(`/suppliers/${supplier.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const canNavigate = showResults && !searching && results.length > 0;

    if (e.key === "Escape") {
      e.preventDefault();
      setShowResults(false);
      setQuery("");
      setSelectedIndex(-1);
      return;
    }

    if (!canNavigate) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      const idx = selectedIndexRef.current;
      if (idx >= 0 && results[idx]) {
        e.preventDefault();
        handleSelect(results[idx]);
      }
    }
  }

  const unreadCount = alerts.length;

  async function handleMarkAllRead() {
    for (const alert of alerts) {
      await markReadMutation.mutateAsync(alert.id);
    }
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-6 relative border-b border-white/10 backdrop-blur-sm"
      style={{ background: "rgba(0, 45, 72, 0.92)" }}
    >

      {/* Search */}
      <div className="relative w-80" ref={searchRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowResults(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search suppliers..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-white/8 border border-white/15 text-white
                     placeholder:text-white/50 rounded-lg focus:outline-none
                     focus:ring-2 focus:ring-white/30 focus:border-white/30"
        />

        {/* Results dropdown */}
        {showResults && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200
                          rounded-lg shadow-lg z-50 max-h-[min(22rem,calc(100vh-5rem))] overflow-y-auto"
            role="listbox"
            aria-label="Supplier search results"
          >
            {searching && (
              <div className="px-4 py-3 text-xs text-surface-400">Searching...</div>
            )}
            {!searching && results.length === 0 && (
              <div className="px-4 py-3 text-xs text-surface-400">
                No suppliers found for "{query}"
              </div>
            )}
            {!searching && results.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-medium text-surface-400 uppercase tracking-wide border-b border-surface-100">
                  Suppliers
                </div>
                {results.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={selectedIndex === i}
                    ref={(el) => {
                      resultItemRefs.current[i] = el;
                    }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    onClick={() => handleSelect(s)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
                      selectedIndex === i ? "bg-brand-50" : "hover:bg-surface-50"
                    }`}
                  >
                    <div className="w-7 h-7 bg-brand-50 rounded-md flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-brand-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">{s.name}</p>
                      <p className="text-xs text-surface-400 truncate">
                        {s.industry ?? "—"}
                        {s.current_risk_level && (
                          <span className={`ml-2 ${riskColor[s.current_risk_level] ?? "text-surface-400"}`}>
                            · {s.current_risk_level} risk
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                      s.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-surface-100 text-surface-500"
                    }`}>
                      {s.status}
                    </span>
                  </button>
                ))}
                <div className="border-t border-surface-100 px-3 py-2">
                  <button
                    onClick={() => { navigate(`/suppliers?search=${encodeURIComponent(query)}`); setShowResults(false); setQuery(""); setSelectedIndex(-1); }}
                    className="text-xs text-brand-600 hover:underline font-medium"
                  >
                    View all results for "{query}" →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => setAlertsOpen((v) => !v)}
            className="relative p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] text-white leading-4 text-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {alertsOpen && (
            <AlertsDropdown
              alerts={alerts}
              loading={alertsLoading}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onMarkAllRead={() => void handleMarkAllRead()}
              onClose={() => setAlertsOpen(false)}
            />
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm
                       hover:bg-white/10 rounded-lg transition-colors"
          >
            <div className="w-7 h-7 bg-[#24BBEE] text-[#002d48] rounded-full flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span className="font-medium text-white">{displayName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-white/50" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-surface-200
                              rounded-lg shadow-lg z-20 py-1">
                <div className="px-3 py-2 border-b border-surface-100">
                  <p className="text-xs text-surface-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600
                             hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
