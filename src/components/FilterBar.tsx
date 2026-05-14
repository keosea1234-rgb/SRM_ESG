import { X, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type { FilterValue } from "../hooks/useFilterState";

export interface SelectOption {
  value: string;
  label: string;
}

export interface FilterFieldConfig {
  key: string;
  type: "search" | "select" | "multiselect";
  placeholder?: string;
  options?: SelectOption[];
  minWidth?: string;
}

interface FilterBarProps {
  fields: FilterFieldConfig[];
  values: Record<string, FilterValue>;
  onChange: (key: string, value: FilterValue) => void;
  onReset: () => void;
  activeCount: number;
  resultCount?: number;
  resultLabel?: string;
}

const FIELD_LABELS: Record<string, string> = {
  search: "Search",
  period: "Period",
  metric: "Metric",
  industry: "Industry",
  riskLevel: "Risk level",
  status: "Status",
  segment: "Segment",
  pillar: "Pillar",
  suppliers: "Suppliers",
};

function MultiSelectDropdown({
  field,
  selected,
  onChange,
}: {
  field: FilterFieldConfig;
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const label =
    selected.length === 0
      ? (field.placeholder ?? `All ${FIELD_LABELS[field.key] ?? field.key}`)
      : selected.length === 1
      ? (field.options?.find((o) => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field w-auto flex items-center gap-2 cursor-pointer"
        style={{ minWidth: field.minWidth ?? "160px" }}
      >
        <span className="flex-1 text-left text-sm truncate">{label}</span>
        <ChevronDown
          className={`w-4 h-4 text-surface-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-surface-200 rounded-xl shadow-lg py-1 min-w-[200px] max-h-[280px] overflow-y-auto">
          {selected.length > 0 && (
            <div className="px-3 py-1.5 border-b border-surface-100 flex items-center justify-between">
              <span className="text-xs text-surface-400">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium"
              >
                Clear
              </button>
            </div>
          )}
          {field.options?.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-surface-50 transition-colors duration-100 ${
                  isSelected ? "text-brand-700" : "text-surface-700"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-brand-600 border-brand-600"
                      : "border-surface-300 bg-white"
                  }`}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  fields,
  values,
  onChange,
  onReset,
  activeCount,
  resultCount,
  resultLabel = "results",
}: FilterBarProps) {
  const activeChips = fields.flatMap((f) => {
    const val = values[f.key];
    if (f.type === "multiselect") {
      const arr = (val as string[]) ?? [];
      return arr.map((v) => {
        const opt = f.options?.find((o) => o.value === v);
        return { key: f.key, value: v, display: opt?.label ?? v };
      });
    }
    if (!val || val === "all" || val === "") return [];
    const opt = f.options?.find((o) => o.value === val);
    const displayLabel = opt?.label ?? String(val);
    const fieldLabel = FIELD_LABELS[f.key] ?? f.key;
    return [{ key: f.key, value: String(val), display: `${fieldLabel}: ${displayLabel}` }];
  });

  function removeChip(key: string, value: string) {
    const field = fields.find((f) => f.key === key);
    if (!field) return;
    if (field.type === "multiselect") {
      const cur = (values[key] as string[]) ?? [];
      onChange(key, cur.filter((v) => v !== value));
    } else {
      onChange(key, "all");
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SlidersHorizontal className="w-4 h-4 text-surface-400 shrink-0" />

        {fields.map((field) => {
          if (field.type === "search") {
            return (
              <div key={field.key} className="relative flex-1 min-w-[220px]">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={field.placeholder ?? "Search..."}
                  value={(values[field.key] as string) ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="input-field pl-9"
                />
              </div>
            );
          }

          if (field.type === "select") {
            return (
              <select
                key={field.key}
                value={(values[field.key] as string) ?? "all"}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="input-field w-auto"
                style={{ minWidth: field.minWidth ?? "140px" }}
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            );
          }

          if (field.type === "multiselect") {
            return (
              <MultiSelectDropdown
                key={field.key}
                field={field}
                selected={(values[field.key] as string[]) ?? []}
                onChange={(val) => onChange(field.key, val)}
              />
            );
          }

          return null;
        })}

        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-surface-500 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
            Clear all
          </button>
        )}
      </div>

      {(activeChips.length > 0 || resultCount !== undefined) && (
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            {activeChips.map((chip, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200"
              >
                {chip.display}
                <button
                  onClick={() => removeChip(chip.key, chip.value)}
                  className="hover:text-brand-900 ml-0.5"
                  aria-label={`Remove ${chip.display} filter`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          {resultCount !== undefined && (
            <span className="text-xs text-surface-400">
              {resultCount} {resultLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
