export interface WgiRiskFactorMatch {
  countryName: string;
  countryCode: string;
  indicatorName: string;
  indicatorCode: string;
  year: string;
  percentile: number;
  geopoliticalRisk: number;
}

const YEAR_RE = /^\d{4}$/;

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

export function scorePoliticalStabilityPercentile(percentile: number): number {
  if (percentile >= 80) return 1;
  if (percentile >= 60) return 2;
  if (percentile >= 40) return 3;
  if (percentile >= 20) return 4;
  return 5;
}

export function findWgiPoliticalStabilityRisk(
  csvText: string,
  supplierCountry: string | null | undefined
): WgiRiskFactorMatch | null {
  const targetCountry = normalize(supplierCountry ?? "");
  if (!targetCountry) return null;

  const rows = parseCsv(csvText);
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalize(cell) === "country name") &&
    row.some((cell) => normalize(cell) === "indicator code")
  );
  if (headerIndex < 0) return null;

  const header = rows[headerIndex];
  const countryNameIndex = header.findIndex((cell) => normalize(cell) === "country name");
  const countryCodeIndex = header.findIndex((cell) => normalize(cell) === "country code");
  const indicatorNameIndex = header.findIndex((cell) => normalize(cell) === "indicator name");
  const indicatorCodeIndex = header.findIndex((cell) => normalize(cell) === "indicator code");
  const yearIndexes = header
    .map((cell, index) => ({ year: cell.trim(), index }))
    .filter(({ year }) => YEAR_RE.test(year))
    .sort((a, b) => Number(b.year) - Number(a.year));

  for (const row of rows.slice(headerIndex + 1)) {
    const countryName = row[countryNameIndex] ?? "";
    const countryCode = row[countryCodeIndex] ?? "";
    const indicatorCode = row[indicatorCodeIndex] ?? "";

    if (normalize(indicatorCode) !== "pv per rnk") continue;
    if (normalize(countryName) !== targetCountry && normalize(countryCode) !== targetCountry) continue;

    const latest = yearIndexes.find(({ index }) => {
      const value = row[index];
      return value != null && value.trim() !== "" && !Number.isNaN(Number(value));
    });
    if (!latest) return null;

    const percentile = Number(row[latest.index]);
    return {
      countryName,
      countryCode,
      indicatorName: row[indicatorNameIndex] ?? "Political Stability and Absence of Violence/Terrorism: Percentile Rank",
      indicatorCode,
      year: latest.year,
      percentile,
      geopoliticalRisk: scorePoliticalStabilityPercentile(percentile),
    };
  }

  return null;
}
