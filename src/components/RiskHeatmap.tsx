const RISK_TYPES = ["Financial", "Operational", "Compliance", "Geopolitical", "Reputational"];

function cellColor(score: number | null): string {
  if (score === null) return "bg-surface-50 text-surface-300";
  if (score >= 4) return "bg-red-100 text-red-700 font-semibold";
  if (score >= 3) return "bg-amber-100 text-amber-700";
  if (score >= 2) return "bg-yellow-50 text-yellow-700";
  return "bg-green-50 text-green-700";
}

interface Props {
  data: { industry: string; risk_type: string; avg_score: number }[];
}

export default function RiskHeatmap({ data }: Props) {
  const industries = [...new Set(data.map((d) => d.industry))].sort();

  if (industries.length === 0) {
    return (
      <div className="px-5 py-8 text-sm text-surface-400 text-center">No risk data available.</div>
    );
  }

  const lookup = new Map(data.map((d) => [`${d.industry}||${d.risk_type}`, d.avg_score]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[480px]">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-surface-400 w-32 border-b border-surface-100">
              Industry
            </th>
            {RISK_TYPES.map((rt) => (
              <th
                key={rt}
                className="px-3 py-2 text-center text-xs font-medium text-surface-600 border-b border-surface-100 whitespace-nowrap"
              >
                {rt}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {industries.map((industry) => (
            <tr key={industry} className="border-b border-surface-50 last:border-0">
              <td className="px-4 py-2.5 text-xs font-medium text-surface-700 whitespace-nowrap">
                {industry}
              </td>
              {RISK_TYPES.map((rt) => {
                const score = lookup.get(`${industry}||${rt}`) ?? null;
                return (
                  <td
                    key={rt}
                    className={`px-3 py-2.5 text-center tabular-nums text-xs rounded-sm ${cellColor(score)}`}
                  >
                    {score !== null ? score.toFixed(1) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
