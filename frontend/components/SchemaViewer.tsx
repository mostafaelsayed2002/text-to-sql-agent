import type { SchemaResponse, SchemaTable } from "@/lib/types";

/** Postgres' full type names are long and add no information here. */
function shortType(type: string) {
  return type
    .replace("character varying", "varchar")
    .replace("timestamp without time zone", "timestamp");
}

/**
 * One table rendered as two rows: column names on top, their types beneath.
 * Wide tables scroll inside their own container so the page never does.
 */
function TableCard({ table }: { table: SchemaTable }) {
  return (
    <div>
      <h3 className="mb-1.5 font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
        {table.name}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="border-collapse text-left">
          <tbody>
            <tr className="bg-slate-50 dark:bg-slate-900">
              {table.columns.map((col) => (
                <th
                  key={col.name}
                  scope="col"
                  title={
                    col.references
                      ? `references ${col.references.table}.${col.references.column}`
                      : col.primary_key
                        ? "primary key"
                        : undefined
                  }
                  className={`whitespace-nowrap px-3 py-2 font-mono text-xs font-medium ${
                    col.primary_key
                      ? "text-slate-900 underline decoration-dotted underline-offset-2 dark:text-slate-100"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {col.name}
                </th>
              ))}
            </tr>
            <tr className="border-t border-slate-200 dark:border-slate-800">
              {table.columns.map((col) => (
                <td
                  key={col.name}
                  className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400 dark:text-slate-500"
                >
                  {shortType(col.type)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SchemaViewer({ schema }: { schema: SchemaResponse }) {
  return (
    <div className="space-y-5">
      {schema.tables.map((table) => (
        <TableCard key={table.name} table={table} />
      ))}
    </div>
  );
}
