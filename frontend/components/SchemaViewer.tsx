import type { SchemaResponse } from "@/lib/types";

export function SchemaViewer({ schema }: { schema: SchemaResponse }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {schema.tables.map((table) => (
        <div key={table.name}>
          <h3 className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
            {table.name}
          </h3>
          <ul className="mt-1.5 space-y-0.5">
            {table.columns.map((col) => (
              <li
                key={col.name}
                className="flex items-baseline gap-2 font-mono text-xs"
              >
                <span
                  className={
                    col.primary_key
                      ? "text-slate-800 underline decoration-dotted underline-offset-2 dark:text-slate-200"
                      : "text-slate-600 dark:text-slate-400"
                  }
                  title={col.primary_key ? "primary key" : undefined}
                >
                  {col.name}
                </span>
                <span className="text-slate-400 dark:text-slate-600">
                  {col.type.replace("character varying", "varchar")}
                </span>
                {col.references && (
                  <span
                    className="text-violet-500 dark:text-violet-400"
                    title={`references ${col.references.table}.${col.references.column}`}
                  >
                    → {col.references.table}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
