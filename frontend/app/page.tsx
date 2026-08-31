"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getSchema, postQuery } from "@/lib/api";
import type { QueryResponse, SchemaResponse } from "@/lib/types";
import { AttemptsTrace } from "@/components/AttemptsTrace";
import { Disclosure } from "@/components/Disclosure";
import { ResultsTable } from "@/components/ResultsTable";
import {
  clampDrawerWidth,
  DEFAULT_DRAWER_WIDTH,
  DRAWER_WIDTH_STORAGE_KEY,
  SchemaDrawer,
} from "@/components/SchemaDrawer";
import { SqlBlock } from "@/components/SqlBlock";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMediaQuery } from "@/lib/useMediaQuery";

const EXAMPLES = [
  "How many customers are from Germany?",
  "Top 5 selling artists by revenue",
  "Which genre has the most tracks?",
  "Delete all customers",
];

export default function Page() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [schemaWidth, setSchemaWidth] = useState(DEFAULT_DRAWER_WIDTH);

  /** Below this the panel overlays; above it the content shifts aside instead. */
  const isWide = useMediaQuery("(min-width: 1024px)");
  const shiftContent = schemaOpen && isWide;
  const [transportError, setTransportError] = useState<string | null>(null);

  /** Lets a newer question cancel an in-flight one instead of racing it. */
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSchema(controller.signal)
      .then(setSchema)
      .catch(() => {
        // The schema panel is supplementary; failing to load it must not break the page.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY));
      if (Number.isFinite(stored) && stored > 0) setSchemaWidth(clampDrawerWidth(stored));
    } catch {
      // Keep the default width.
    }
  }, []);

  useEffect(() => {
    const onResize = () => setSchemaWidth((w) => clampDrawerWidth(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setTransportError(null);
    setResponse(null);

    try {
      setResponse(await postQuery(trimmed, controller.signal));
    } catch (err) {
      if (controller.signal.aborted) return;
      setTransportError(
        err instanceof ApiError ? err.message : "Could not reach the API.",
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function useExample(example: string) {
    setQuestion(example);
    void ask(example);
  }

  const showTrace = response && response.attempts.length > 0;

  return (
    <div
      style={{ paddingRight: shiftContent ? schemaWidth : undefined }}
      className="transition-[padding] duration-200 ease-out"
    >
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <header>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Text-to-SQL Agent
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {schema && (
              <button
                type="button"
                onClick={() => setSchemaOpen(true)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
              >
                Schema
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Ask a question about the Chinook music-store database. The model writes the
          SQL; a validator decides whether it is safe to run before anything reaches
          Postgres.
        </p>
      </header>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="question" className="sr-only">
          Your question
        </label>
        <div className="flex gap-2">
          <input
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="How many customers are from Germany?"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400 dark:focus:ring-slate-400"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {loading ? "Asking…" : "Ask"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={loading}
              onClick={() => useExample(example)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-40 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {loading && (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
          Generating SQL and checking it…
        </p>
      )}

      {transportError && (
        <p className="mt-8 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          {transportError}
        </p>
      )}

      {response && (
        <div className="mt-10 space-y-6">
          {response.error && (
            <div
              className={
                response.refused
                  ? "rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/50 dark:bg-amber-950/30"
                  : "rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-900/50 dark:bg-rose-950/30"
              }
            >
              <h2
                className={`text-sm font-semibold ${
                  response.refused
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-rose-900 dark:text-rose-200"
                }`}
              >
                {response.refused ? "Refused" : "No answer"}
              </h2>
              <p
                className={`mt-1 text-sm leading-relaxed ${
                  response.refused
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-rose-800 dark:text-rose-300"
                }`}
              >
                {response.error}
              </p>
            </div>
          )}

          {response.sql && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Generated SQL
              </h2>
              <SqlBlock sql={response.sql} className="mt-2" />
            </section>
          )}

          {response.results && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Results
              </h2>
              <div className="mt-2">
                <ResultsTable results={response.results} />
              </div>
            </section>
          )}

          {showTrace && (
            <Disclosure
              summary="Attempts"
              count={response.attempts.length}
              defaultOpen={response.attempts.length > 1}
            >
              <AttemptsTrace attempts={response.attempts} />
            </Disclosure>
          )}
        </div>
      )}

      </main>

      {schema && (
        <SchemaDrawer
          schema={schema}
          open={schemaOpen}
          width={schemaWidth}
          onWidthChange={setSchemaWidth}
          onClose={() => setSchemaOpen(false)}
        />
      )}
    </div>
  );
}
