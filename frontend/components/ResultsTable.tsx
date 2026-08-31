import type { QueryResults } from "@/lib/types";

function renderCell(value: string | number | boolean | null) {
  if (value === null) return <span className="text-slate-400 italic">null</span>;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function ResultsTable({ results }: { results: QueryResults }) {
  if (results.row_count === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The query ran successfully and returned no rows.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900">
              {results.columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="whitespace-nowrap px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.rows.map((row, r) => (
              <tr
                key={r}
                className="border-t border-slate-200 dark:border-slate-800"
              >
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px]"
                  >
                    {renderCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {results.row_count} {results.row_count === 1 ? "row" : "rows"}
        {results.truncated && " · truncated by the enforced LIMIT"}
      </p>
    </div>
  );
}
