import type { ReactNode } from "react";

/**
 * Collapsible section built on native <details>, so it works without JS and
 * needs no open/closed state of its own.
 */
export function Disclosure({
  summary,
  count,
  defaultOpen = false,
  children,
}: {
  summary: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 dark:border-slate-800"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-700 marker:content-none hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4.5 2.5 8 6l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {summary}
        {count !== undefined && (
          <span className="text-slate-400 dark:text-slate-500">({count})</span>
        )}
      </summary>
      <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
        {children}
      </div>
    </details>
  );
}
