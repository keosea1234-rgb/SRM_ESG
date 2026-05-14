import type { LeaderboardRow } from "../../services/esg";

interface Props {
  rows: LeaderboardRow[];
}

export default function ESGTopPerformers({ rows }: Props) {
  const top = rows.slice(0, 5);

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-surface-900">Top performers</h2>
        <span className="text-xs text-surface-400">{rows.length} suppliers</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {top.map((row, i) => {
          const industry = row.industry ?? row.srm_suppliers?.industry ?? null;
          const name = row.srm_suppliers?.name ?? "—";

          return (
            <div
              key={row.supplier_id}
              className="bg-white rounded-xl border border-surface-200 p-4 min-w-[160px] flex flex-col gap-2 shrink-0"
            >
              <span className="text-xs text-surface-400">#{i + 1}</span>
              <p className="text-sm font-semibold text-surface-900 truncate" title={name}>
                {name}
              </p>
              <p className="text-xs text-surface-400 truncate" title={industry ?? undefined}>
                {industry ?? "—"}
              </p>
              <p className="text-3xl font-bold text-surface-900">{row.overall_esg_score}</p>
              <div className="flex flex-wrap gap-1">
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  E {row.env_score}
                </span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  S {row.social_score}
                </span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  G {row.gov_score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
