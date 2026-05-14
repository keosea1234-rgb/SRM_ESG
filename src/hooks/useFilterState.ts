import { useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export type FilterValue = string | string[];

export interface FilterConfig<T extends Record<string, FilterValue>> {
  defaults: T;
  debounceKeys?: (keyof T)[];
  debounceMs?: number;
}

export function useFilterState<T extends Record<string, FilterValue>>(
  config: FilterConfig<T>
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { defaults, debounceKeys = [], debounceMs = 400 } = config;

  function parseParams(): T {
    const result = { ...defaults };
    for (const key in defaults) {
      const val = searchParams.get(key);
      if (val !== null) {
        (result as Record<string, FilterValue>)[key] = Array.isArray(defaults[key])
          ? val ? val.split(",") : []
          : val;
      }
    }
    return result;
  }

  const [filters, setFiltersState] = useState<T>(parseParams);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const setFilter = useCallback(
    (key: keyof T, value: FilterValue) => {
      const commit = () => {
        setFiltersState((prev) => ({ ...prev, [key]: value }));
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            const isDefault = Array.isArray(value) ? value.length === 0 : value === defaults[key];
            if (isDefault) next.delete(key as string);
            else next.set(key as string, Array.isArray(value) ? value.join(",") : value);
            return next;
          },
          { replace: true }
        );
      };

      if (debounceKeys.includes(key)) {
        clearTimeout(timers.current[key as string]);
        setFiltersState((prev) => ({ ...prev, [key]: value }));
        timers.current[key as string] = setTimeout(commit, debounceMs);
      } else {
        commit();
      }
    },
    [defaults, debounceKeys, debounceMs, setSearchParams]
  );

  const resetFilters = useCallback(() => {
    setFiltersState({ ...defaults });
    setSearchParams({}, { replace: true });
  }, [defaults, setSearchParams]);

  const activeCount = Object.entries(filters).filter(([key, val]) => {
    const def = defaults[key as keyof T];
    return Array.isArray(val) ? val.length > 0 : val !== def;
  }).length;

  return { filters, setFilter, resetFilters, activeCount };
}
