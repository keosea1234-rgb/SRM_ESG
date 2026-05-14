import type { HTMLAttributes } from "react";

/**
 * Block placeholder with surface-tone shimmer (see `.skeleton-shimmer` in index.css).
 */
export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["skeleton-shimmer", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
