import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import ESGPillarCard from "../components/ESGPillarCard";
import ESGAssessmentModal from "../components/ESGAssessmentModal";
import FilterBar, { type FilterFieldConfig } from "../components/FilterBar";
import { useFilterState } from "../hooks/useFilterState";
import { queryKeys } from "../lib/queryKeys";
import { fetchEsgSummary, fetchEsgLeaderboard, fetchEsgHotspots, type LeaderboardRow } from "../services/esg";
import { usePermissions } from "../context/AuthContext";
import {
  gradeEnvMetrics,
  gradeSocialMetrics,
  gradeGovMetrics,
  gradeFromScore,
  pctDisplayToScore,
} from "../lib/esgGrading";
import ESGCompositeIndex from "../components/esg/ESGCompositeIndex";
import ESGPillarHeader from "../components/esg/ESGPillarHeader";
import ESGHotspots from "../components/esg/ESGHotspots";
import ESGIndustryBenchmark from "../components/esg/ESGIndustryBenchmark";
import ESGTopPerformers from "../components/esg/ESGTopPerformers";
import { Skeleton } from "../components/ui/Skeleton";
import { fanInVariants, fanInItem } from "../lib/animation";
import { usePageTitle } from "../hooks/usePageTitle";

function fmt(val: number | null, unit = ""): string {
  if (val == null) return "—";
  return `${val}${unit}`;
}

function pillarLetterToFilterKey(letter: "E" | "S" | "G"): "env" | "social" | "gov" {
  if (letter === "E") return "env";
  if (letter === "S") return "social";
  return "gov";
}

function pillarScore(row: LeaderboardRow, key: "env" | "social" | "gov"): number {
  if (key === "env") return row.env_score;
  if (key === "social") return row.social_score;
  return row.gov_score;
}

export default function ESGPage() {
  usePageTitle("ESG");
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const permissions = usePermissions();

  const { data: summary, isLoading } = useQuery({
    queryKey: queryKeys.esgSummary(),
    queryFn: fetchEsgSummary,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: queryKeys.esgLeaderboard(),
    queryFn: fetchEsgLeaderboard,
  });

  const { data: hotspots = [] } = useQuery({
    queryKey: queryKeys.esgHotspots(),
    queryFn: fetchEsgHotspots,
  });

  const { filters, setFilter, resetFilters, activeCount } = useFilterState({
    defaults: {
      status: "all",
      pillar: [] as string[],
    },
    debounceKeys: [],
  });

  const filteredLeaderboard = useMemo(() => {
    if (!leaderboard.length) return [];
    const selectedPillars = (filters.pillar as string[]) ?? [];
    const rows = [...leaderboard];

    if (selectedPillars.length === 1) {
      const p = selectedPillars[0];
      if (p === "env" || p === "social" || p === "gov") {
        rows.sort((a, b) => pillarScore(b, p) - pillarScore(a, p));
        return rows;
      }
    }

    if (selectedPillars.length === 0) {
      rows.sort((a, b) => b.overall_esg_score - a.overall_esg_score);
      return rows;
    }

    const filtered = rows.filter((row) =>
      selectedPillars.some(
        (p) =>
          (p === "env" && row.env_score >= 70) ||
          (p === "social" && row.social_score >= 70) ||
          (p === "gov" && row.gov_score >= 70)
      )
    );
    filtered.sort((a, b) => b.overall_esg_score - a.overall_esg_score);
    return filtered;
  }, [leaderboard, filters.pillar]);

  const filterFields: FilterFieldConfig[] = [
    {
      key: "pillar",
      type: "multiselect",
      placeholder: "All pillars",
      options: [
        { value: "env", label: "Environmental" },
        { value: "social", label: "Social" },
        { value: "gov", label: "Governance" },
      ],
      minWidth: "150px",
    },
  ];

  const pillarsData = useMemo(() => {
    if (!summary) return [];

    const envGrades = gradeEnvMetrics({
      renewable_energy_pct: summary.env_metrics.avg_renewable_energy_pct,
      waste_recycling_pct: summary.env_metrics.avg_waste_recycling_pct,
      carbon_footprint_tons: summary.env_metrics.avg_carbon_footprint_tons,
    });

    const socialGrades = gradeSocialMetrics({
      women_in_mgmt_pct: summary.social_metrics.avg_women_in_mgmt_pct,
      lost_time_injury_rate: summary.social_metrics.avg_lost_time_injury_rate,
      living_wage_compliant: null,
      child_labor_policy: null,
    });

    const govGrades = gradeGovMetrics({
      anti_corruption_policy: null,
      independent_audit: null,
      gdpr_compliant: null,
      data_breach_incidents: summary.gov_metrics.avg_data_breach_incidents,
    });

    const livingWageGrade = gradeFromScore(pctDisplayToScore(summary.social_metrics.living_wage_compliant_pct));
    const childLaborGrade = gradeFromScore(pctDisplayToScore(summary.social_metrics.child_labor_policy_pct));
    const antiCorruptionGrade = gradeFromScore(pctDisplayToScore(summary.gov_metrics.anti_corruption_policy_pct));
    const independentAuditGrade = gradeFromScore(pctDisplayToScore(summary.gov_metrics.independent_audit_pct));
    const gdprGrade = gradeFromScore(pctDisplayToScore(summary.gov_metrics.gdpr_compliant_pct));

    return [
      {
        pillar: "E" as const,
        score: summary.avg_env,
        metrics: [
          {
            label: "Avg Renewable Energy",
            value: fmt(summary.env_metrics.avg_renewable_energy_pct, "%"),
            grade: envGrades.renewable_energy,
          },
          {
            label: "Avg Waste Recycling",
            value: fmt(summary.env_metrics.avg_waste_recycling_pct, "%"),
            grade: envGrades.waste_recycling,
          },
          {
            label: "Avg Carbon Footprint",
            value: fmt(summary.env_metrics.avg_carbon_footprint_tons, " t"),
            grade: envGrades.carbon_footprint,
          },
          {
            label: "Avg Water Usage",
            value: fmt(summary.env_metrics.avg_water_usage_m3, " m³"),
            displayOnly: true,
          },
        ],
        certifications: ["ISO14001"],
      },
      {
        pillar: "S" as const,
        score: summary.avg_social,
        metrics: [
          {
            label: "Women in Management",
            value: fmt(summary.social_metrics.avg_women_in_mgmt_pct, "%"),
            grade: socialGrades.women_in_mgmt,
          },
          {
            label: "Avg Injury Rate",
            value: fmt(summary.social_metrics.avg_lost_time_injury_rate),
            grade: socialGrades.injury_rate,
          },
          {
            label: "Living Wage Compliant",
            value: summary.social_metrics.living_wage_compliant_pct ?? "—",
            grade: livingWageGrade,
          },
          {
            label: "Child Labor Policy",
            value: summary.social_metrics.child_labor_policy_pct ?? "—",
            grade: childLaborGrade,
          },
        ],
        certifications: ["ISO45001", "SA8000"],
      },
      {
        pillar: "G" as const,
        score: summary.avg_gov,
        metrics: [
          {
            label: "Anti-Corruption Policy",
            value: summary.gov_metrics.anti_corruption_policy_pct ?? "—",
            grade: antiCorruptionGrade,
          },
          {
            label: "Independent Audit",
            value: summary.gov_metrics.independent_audit_pct ?? "—",
            grade: independentAuditGrade,
          },
          {
            label: "GDPR Compliant",
            value: summary.gov_metrics.gdpr_compliant_pct ?? "—",
            grade: gdprGrade,
          },
          {
            label: "Avg Data Breaches",
            value: fmt(summary.gov_metrics.avg_data_breach_incidents),
            grade: govGrades.data_breaches,
          },
        ],
        certifications: ["ISO27001"],
      },
    ];
  }, [summary]);

  if (isLoading && !summary) {
    return (
      <div className="p-6 space-y-6" aria-busy="true">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1">
            <Skeleton className="h-8 w-52 max-w-full rounded-lg" />
            <Skeleton className="h-4 w-full max-w-md rounded-md" />
          </div>
          <Skeleton className="h-10 w-44 rounded-lg shrink-0 hidden sm:block" />
        </div>
        <div className="card p-6">
          <div className="flex flex-wrap gap-6 items-end">
            <Skeleton className="h-20 w-28 rounded-xl shrink-0" />
            <div className="flex-1 space-y-3 min-w-[200px]">
              <Skeleton className="h-6 w-full rounded-lg" />
              <Skeleton className="h-4 w-4/5 max-w-lg rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-4 space-y-3">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-8 w-24 rounded" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 card p-4 space-y-3">
            <Skeleton className="h-4 w-36 rounded" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <div className="lg:col-span-2 card p-4 space-y-3">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-4 space-y-3">
              <Skeleton className="h-5 w-8 rounded" />
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-3 w-full rounded" />
              ))}
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <div className="flex gap-3 overflow-hidden pb-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-surface-200 p-4 min-w-[160px] flex flex-col gap-2 shrink-0"
              >
                <Skeleton className="h-3 w-8 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-9 w-14 rounded" />
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-5 w-10 rounded-full" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-52 rounded" />
            <Skeleton className="h-3 w-20 rounded shrink-0" />
          </div>
          <div className="px-5 pt-4 pb-2">
            <Skeleton className="h-10 w-full max-w-md rounded-lg" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/50">
                  <th className="px-5 py-3 w-10">
                    <Skeleton className="h-3 w-6 rounded" />
                  </th>
                  <th className="px-5 py-3">
                    <Skeleton className="h-3 w-20 rounded" />
                  </th>
                  <th className="px-5 py-3">
                    <Skeleton className="h-3 w-16 rounded" />
                  </th>
                  <th className="px-5 py-3 text-center">
                    <Skeleton className="h-3 w-14 rounded mx-auto" />
                  </th>
                  <th className="px-5 py-3 text-right w-24">
                    <Skeleton className="h-3 w-14 rounded ml-auto" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
                  <tr key={r}>
                    <td className="px-5 py-3">
                      <Skeleton className="h-3 w-6 rounded" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 max-w-[200px] rounded" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-3 w-24 rounded" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center gap-2">
                        <Skeleton className="h-5 w-8 rounded-full" />
                        <Skeleton className="h-5 w-8 rounded-full" />
                        <Skeleton className="h-5 w-8 rounded-full" />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Skeleton className="h-6 w-10 rounded ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-display font-semibold text-surface-900">ESG Overview</h1>
          {permissions.canWriteESG && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700"
            >
              <Plus className="w-4 h-4" /> New Assessment
            </button>
          )}
        </div>
        <p className="text-sm text-surface-500 mt-0.5">
          Environmental, Social & Governance performance across {summary?.total ?? 0} approved suppliers
        </p>
      </div>

      <ESGCompositeIndex
        score={summary?.avg_esg ?? 0}
        total={summary?.total ?? 0}
        target={70}
        vsLastQuarter={null}
        sparklineData={[]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ESGPillarHeader pillar="E" score={summary?.avg_env ?? 0} target={70} weight="50%" color="#0369a1" />
        <ESGPillarHeader pillar="S" score={summary?.avg_social ?? 0} target={65} weight="20%" color="#7c3aed" />
        <ESGPillarHeader pillar="G" score={summary?.avg_gov ?? 0} target={65} weight="30%" color="#b45309" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ESGHotspots hotspots={hotspots} />
        </div>
        <div className="lg:col-span-2">{summary && <ESGIndustryBenchmark summary={summary} />}</div>
      </div>

      {(summary?.avg_esg ?? 0) > 0 && (summary?.avg_esg ?? 0) < 50 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
          ⚠ Average ESG score is below 50 — review supplier assessments
        </div>
      )}

      {(summary?.total ?? 0) === 0 && (
        <div className="bg-surface-50 border border-surface-200 rounded-lg px-4 py-8 text-center">
          <p className="text-sm text-surface-500">No approved assessments yet.</p>
          {permissions.canWriteESG && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-brand-600 hover:underline font-medium"
            >
              Create the first assessment →
            </button>
          )}
        </div>
      )}

      {pillarsData.length > 0 && (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          variants={fanInVariants}
          initial="hidden"
          animate="visible"
        >
          {pillarsData.map((p) => {
            const filterKey = pillarLetterToFilterKey(p.pillar);
            const pillarSelection = (filters.pillar as string[]) ?? [];
            const selected =
              pillarSelection.length === 1 && pillarSelection[0] === filterKey;
            return (
              <motion.div key={p.pillar} variants={fanInItem}>
                <ESGPillarCard
                  {...p}
                  selected={selected}
                  onHeaderClick={() => {
                    const isOnlyThis =
                      pillarSelection.length === 1 && pillarSelection[0] === filterKey;
                    setFilter("pillar", isOnlyThis ? [] : [filterKey]);
                  }}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <ESGTopPerformers rows={leaderboard} />

      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-900">Supplier ESG Leaderboard</h2>
          {leaderboard.length > 0 && (
            <span className="text-xs text-surface-400">{filteredLeaderboard.length} suppliers</span>
          )}
        </div>
        <div className="px-5 pt-4 pb-2">
          <FilterBar
            fields={filterFields}
            values={filters}
            onChange={(key, val) => setFilter(key as keyof typeof filters, val)}
            onReset={resetFilters}
            activeCount={activeCount}
            resultCount={filteredLeaderboard.length}
            resultLabel="suppliers"
          />
        </div>
        {leaderboard.length === 0 ? (
          <p className="px-5 py-8 text-sm text-surface-400 text-center">No approved assessments yet</p>
        ) : filteredLeaderboard.length === 0 ? (
          <p className="px-5 py-8 text-sm text-surface-400 text-center">No suppliers match the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/50 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                  <th className="px-5 py-3 w-10">#</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Industry</th>
                  <th className="px-5 py-3 text-center">Scores</th>
                  <th className="px-5 py-3 text-right w-24">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredLeaderboard.map((row, i) => (
                  <tr
                    key={row.supplier_id}
                    className="hover:bg-surface-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/suppliers/${row.supplier_id}`)}
                  >
                    <td className="px-5 py-3 text-xs text-surface-400 font-medium">{i + 1}</td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-surface-900 truncate max-w-[200px]">
                        {row.srm_suppliers?.name}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-xs text-surface-400">
                      {row.srm_suppliers?.industry ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          E {row.env_score}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                          S {row.social_score}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          G {row.gov_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-lg font-bold text-surface-900 text-right">
                      {row.overall_esg_score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ESGAssessmentModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            void queryClient.invalidateQueries({ queryKey: ["esg-summary"] });
            void queryClient.invalidateQueries({ queryKey: ["esg-leaderboard"] });
            void queryClient.invalidateQueries({ queryKey: ["esg-hotspots"] });
          }}
        />
      )}
    </div>
  );
}
