import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · SRM` : "SRM";
    return () => {
      document.title = "SRM";
    };
  }, [title]);
}

