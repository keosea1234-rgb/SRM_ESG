import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import type { ReactNode } from "react";

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const boundaryRef = useRef<ErrorBoundary>(null);

  useEffect(() => {
    boundaryRef.current?.reset();
  }, [location.pathname]);

  // ESGAssessmentModal handles async API errors inline and does not bubble to page boundary.
  return <ErrorBoundary ref={boundaryRef}>{children}</ErrorBoundary>;
}
