import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Factory,
  FileSpreadsheet,
  Leaf,
  Radar,
  ShieldCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePageTitle } from "../hooks/usePageTitle";
import { queryKeys } from "../lib/queryKeys";
import {
  fetchCarbonSummary,
  fetchMaterialitySummary,
  fetchMonitoringSummary,
  fetchProductComplianceSummary,
  fetchReportingCoverage,
  fetchRiskIndicatorSummary,
} from "../services/compliance";

type TabKey =
  | "reporting"
  | "materiality"
  | "carbon"
  | "risk"
  | "product"
  | "monitoring";

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: "reporting", label: "Reporting", icon: FileSpreadsheet },
  { key: "materiality", label: "Materiality", icon: Radar },
  { key: "carbon", label: "Carbon", icon: Leaf },
  { key: "risk", label: "Risk Indicators", icon: ShieldCheck },
  { key: "product", label: "Product Compliance", icon: Boxes },
  { key: "monitoring", label: "Monitoring", icon: AlertTriangle },
];

const COLORS = ["#00395A", "#24BBEE", "#1BCDAC", "#F59E0B", "#EF4444", "#64748B"];

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-surface-900">{value}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {hint ? <p className="mt-3 text-xs text-surface-500">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 p-6 text-sm text-surface-600">
      {text}
    </div>
  );
}

function MiniBarChart({ data }: { data: Array<{ name: string; value: number }> }) {
  if (data.length === 0) {
    return <EmptyState text="No chartable records yet." />;
  }

  return (
    <div className="h-72 rounded-lg border border-surface-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function objectToChartData(input: Record<string, number> | undefined) {
  return Object.entries(input ?? {})
    .map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value: Math.round(Number(value) * 10) / 10,
    }))
    .filter((row) => Number.isFinite(row.value));
}

function complianceErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (message.includes("HTTP 404")) {
    return "Compliance endpoints are not available in this backend instance. Mount the compliance backend and restart the API server.";
  }

  if (
    /relation .* does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /HTTP 500/.test(message)
  ) {
    return "Compliance schema or seed data is not ready. Apply supabase/migrations/20240101000014_compliance.sql and refresh this page.";
  }

  return message || "Compliance data could not be loaded. Verify the compliance backend and migration are in place.";
}

export default function CompliancePage() {
  usePageTitle("Compliance");

  const [activeTab, setActiveTab] = useState<TabKey>("reporting");

  const reporting = useQuery({
    queryKey: queryKeys.compliance("reporting"),
    queryFn: fetchReportingCoverage,
  });
  const materiality = useQuery({
    queryKey: queryKeys.compliance("materiality"),
    queryFn: fetchMaterialitySummary,
  });
  const carbon = useQuery({
    queryKey: queryKeys.compliance("carbon"),
    queryFn: fetchCarbonSummary,
  });
  const risk = useQuery({
    queryKey: queryKeys.compliance("risk-indicators"),
    queryFn: fetchRiskIndicatorSummary,
  });
  const product = useQuery({
    queryKey: queryKeys.compliance("product"),
    queryFn: fetchProductComplianceSummary,
  });
  const monitoring = useQuery({
    queryKey: queryKeys.compliance("monitoring"),
    queryFn: fetchMonitoringSummary,
  });

  const anyError = [reporting, materiality, carbon, risk, product, monitoring].find(
    (query) => query.error
  );
  const loading = [reporting, materiality, carbon, risk, product, monitoring].some(
    (query) => query.isLoading
  );

  const materialityChartData = useMemo(
    () =>
      (materiality.data?.topics ?? []).slice(0, 12).map((topic) => ({
        name: topic.title,
        value: Math.max(Number(topic.impact_score), Number(topic.financial_score)),
      })),
    [materiality.data]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700">ESG Compliance Expansion</p>
          <h1 className="mt-1 text-3xl font-semibold text-surface-950">Compliance Hub</h1>
          <p className="mt-2 max-w-3xl text-sm text-surface-600">
            Reporting coverage, double materiality, Scope 3 carbon, product regulations,
            risk indicators, and incident monitoring.
          </p>
        </div>

        <div className="inline-flex flex-wrap gap-2 rounded-lg border border-surface-200 bg-white p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-brand-900 text-white" : "text-surface-600 hover:bg-surface-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-surface-200 bg-white p-4 text-sm text-surface-600">
          Loading compliance data...
        </div>
      ) : null}

      {anyError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {complianceErrorMessage(anyError.error)}
        </div>
      ) : null}

      {activeTab === "reporting" ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Frameworks"
              value={reporting.data?.frameworks.length ?? 0}
              icon={FileSpreadsheet}
            />
            <StatCard
              label="Requirements"
              value={reporting.data?.total_requirements ?? 0}
              icon={BarChart3}
            />
            <StatCard
              label="Mapped"
              value={reporting.data?.mapped_requirements ?? 0}
              icon={ShieldCheck}
            />
            <StatCard
              label="Evidence"
              value={reporting.data?.evidence_count ?? 0}
              icon={Factory}
            />
          </div>

          <MiniBarChart data={objectToChartData(reporting.data?.response_status_counts)} />

          <div className="grid gap-3 md:grid-cols-3">
            {(reporting.data?.frameworks ?? []).map((framework) => (
              <div key={framework.id} className="rounded-lg border border-surface-200 bg-white p-4">
                <p className="text-sm font-semibold text-surface-900">{framework.name}</p>
                <p className="mt-1 text-xs text-surface-500">{framework.code}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "materiality" ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Assessments"
              value={materiality.data?.assessments.length ?? 0}
              icon={Radar}
            />
            <StatCard label="Topics" value={materiality.data?.topics.length ?? 0} icon={BarChart3} />
            <StatCard
              label="Material Topics"
              value={materiality.data?.material_topics_count ?? 0}
              icon={ShieldCheck}
            />
          </div>

          <MiniBarChart data={materialityChartData} />
        </section>
      ) : null}

      {activeTab === "carbon" ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Total tCO2e"
              value={(carbon.data?.total_tco2e ?? 0).toFixed(1)}
              icon={Leaf}
            />
            <StatCard
              label="Scope 3 tCO2e"
              value={(carbon.data?.scope3_tco2e ?? 0).toFixed(1)}
              icon={Factory}
            />
            <StatCard
              label="SBTi Targets"
              value={carbon.data?.sbti_targets.length ?? 0}
              icon={ShieldCheck}
            />
            <StatCard
              label="Product PCFs"
              value={carbon.data?.product_footprints.length ?? 0}
              icon={Boxes}
            />
          </div>

          <MiniBarChart data={objectToChartData(carbon.data?.scope3_by_category)} />
        </section>
      ) : null}

      {activeTab === "risk" ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Indicators" value={risk.data?.total_indicators ?? 0} icon={ShieldCheck} />
            <StatCard label="Active" value={risk.data?.active_indicators ?? 0} icon={BarChart3} />
            <StatCard
              label="Supplier Scores"
              value={risk.data?.supplier_score_count ?? 0}
              icon={Factory}
            />
            <StatCard
              label="Tier Links"
              value={risk.data?.tier_relationship_count ?? 0}
              icon={Boxes}
            />
          </div>

          <MiniBarChart data={objectToChartData(risk.data?.category_counts)} />
        </section>
      ) : null}

      {activeTab === "product" ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Products" value={product.data?.product_count ?? 0} icon={Boxes} />
            <StatCard
              label="Requirements"
              value={product.data?.requirement_count ?? 0}
              icon={FileSpreadsheet}
            />
            <StatCard
              label="Critical"
              value={product.data?.critical_requirement_count ?? 0}
              icon={AlertTriangle}
            />
            <StatCard
              label="Assessments"
              value={Object.values(product.data?.assessment_status_counts ?? {}).reduce(
                (sum, count) => sum + count,
                0
              )}
              icon={ShieldCheck}
            />
          </div>

          <MiniBarChart data={objectToChartData(product.data?.assessment_status_counts)} />
        </section>
      ) : null}

      {activeTab === "monitoring" ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Sources" value={monitoring.data?.sources.length ?? 0} icon={Factory} />
            <StatCard label="Hits" value={monitoring.data?.hits.length ?? 0} icon={AlertTriangle} />
            <StatCard
              label="Incidents"
              value={monitoring.data?.incidents.length ?? 0}
              icon={ShieldCheck}
            />
            <StatCard
              label="Pending"
              value={monitoring.data?.review_status_counts.pending ?? 0}
              icon={Radar}
            />
          </div>

          <MiniBarChart data={objectToChartData(monitoring.data?.review_status_counts)} />
        </section>
      ) : null}
    </div>
  );
}
