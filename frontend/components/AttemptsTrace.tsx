import type { Attempt, AttemptStatus } from "@/lib/types";
import { SqlBlock } from "./SqlBlock";

/**
 * The retry trace. This is the part of the UI worth looking at: it shows the
 * system recovering from a bad generation rather than merely working.
 */

const LABEL: Record<AttemptStatus, string> = {
  validation_failed: "refused by validator",
  execution_failed: "failed in the database",
  succeeded: "succeeded",
};

const BADGE: Record<AttemptStatus, string> = {
  validation_failed:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  execution_failed:
    "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  succeeded:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

function AttemptRow({ attempt }: { attempt: Attempt }) {
  return (
    <li className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-slate-400 dark:text-slate-500">
          {attempt.n}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[attempt.status]}`}
        >
          {LABEL[attempt.status]}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {(attempt.duration_ms / 1000).toFixed(2)}s
        </span>
      </div>

      {attempt.error && (
        <p className="mt-2 font-mono text-[13px] text-slate-600 dark:text-slate-400">
          {attempt.error}
        </p>
      )}

      {attempt.sql && <SqlBlock sql={attempt.sql} className="mt-2" />}
    </li>
  );
}

export function AttemptsTrace({ attempts }: { attempts: Attempt[] }) {
  return (
    <ol className="space-y-4">
      {attempts.map((attempt) => (
        <AttemptRow key={attempt.n} attempt={attempt} />
      ))}
    </ol>
  );
}
