import type { QueryResponse, SchemaResponse, SchemaTable } from "./types";

/**
 * Fixtures backing the /api/mock routes.
 *
 * These exist so the UI can be built and demoed before the backend lands. They
 * deliberately cover the three states the page must render well: a clean answer,
 * a recovery after a failed attempt, and a validator refusal.
 */

function table(
  name: string,
  cols: Array<[string, string, boolean, boolean, [string, string]?]>,
): SchemaTable {
  return {
    name,
    columns: cols.map(([cname, type, nullable, pk, fk]) => ({
      name: cname,
      type,
      nullable,
      primary_key: pk,
      references: fk ? { table: fk[0], column: fk[1] } : null,
    })),
  };
}

export const MOCK_SCHEMA: SchemaResponse = {
  tables: [
    table("artist", [
      ["artist_id", "integer", false, true],
      ["name", "character varying", true, false],
    ]),
    table("album", [
      ["album_id", "integer", false, true],
      ["title", "character varying", false, false],
      ["artist_id", "integer", false, false, ["artist", "artist_id"]],
    ]),
    table("track", [
      ["track_id", "integer", false, true],
      ["name", "character varying", false, false],
      ["album_id", "integer", true, false, ["album", "album_id"]],
      ["media_type_id", "integer", false, false, ["media_type", "media_type_id"]],
      ["genre_id", "integer", true, false, ["genre", "genre_id"]],
      ["composer", "character varying", true, false],
      ["milliseconds", "integer", false, false],
      ["bytes", "integer", true, false],
      ["unit_price", "numeric", false, false],
    ]),
    table("genre", [
      ["genre_id", "integer", false, true],
      ["name", "character varying", true, false],
    ]),
    table("media_type", [
      ["media_type_id", "integer", false, true],
      ["name", "character varying", true, false],
    ]),
    table("playlist", [
      ["playlist_id", "integer", false, true],
      ["name", "character varying", true, false],
    ]),
    table("playlist_track", [
      ["playlist_id", "integer", false, true, ["playlist", "playlist_id"]],
      ["track_id", "integer", false, true, ["track", "track_id"]],
    ]),
    table("customer", [
      ["customer_id", "integer", false, true],
      ["first_name", "character varying", false, false],
      ["last_name", "character varying", false, false],
      ["company", "character varying", true, false],
      ["address", "character varying", true, false],
      ["city", "character varying", true, false],
      ["state", "character varying", true, false],
      ["country", "character varying", true, false],
      ["postal_code", "character varying", true, false],
      ["phone", "character varying", true, false],
      ["email", "character varying", false, false],
      ["support_rep_id", "integer", true, false, ["employee", "employee_id"]],
    ]),
    table("employee", [
      ["employee_id", "integer", false, true],
      ["last_name", "character varying", false, false],
      ["first_name", "character varying", false, false],
      ["title", "character varying", true, false],
      ["reports_to", "integer", true, false, ["employee", "employee_id"]],
      ["hire_date", "timestamp without time zone", true, false],
      ["email", "character varying", true, false],
    ]),
    table("invoice", [
      ["invoice_id", "integer", false, true],
      ["customer_id", "integer", false, false, ["customer", "customer_id"]],
      ["invoice_date", "timestamp without time zone", false, false],
      ["billing_country", "character varying", true, false],
      ["total", "numeric", false, false],
    ]),
    table("invoice_line", [
      ["invoice_line_id", "integer", false, true],
      ["invoice_id", "integer", false, false, ["invoice", "invoice_id"]],
      ["track_id", "integer", false, false, ["track", "track_id"]],
      ["unit_price", "numeric", false, false],
      ["quantity", "integer", false, false],
    ]),
  ],
};

/** Words that should trip the validator. The real check is sqlglot on the SQL,
 *  not a keyword scan on the question — this is mock-only. */
const DESTRUCTIVE = /\b(delete|drop|truncate|update|insert|alter|grant)\b/i;

const TOP_ARTISTS_SQL = `SELECT ar.name AS artist,
       ROUND(SUM(il.unit_price * il.quantity), 2) AS revenue
FROM invoice_line AS il
JOIN track AS t ON t.track_id = il.track_id
JOIN album AS al ON al.album_id = t.album_id
JOIN artist AS ar ON ar.artist_id = al.artist_id
GROUP BY ar.name
ORDER BY revenue DESC
LIMIT 5;`;

export function mockQuery(question: string): QueryResponse {
  const q = question.toLowerCase();

  // Scenario 1 — validator refusal.
  if (DESTRUCTIVE.test(q)) {
    return {
      question,
      sql: null,
      results: null,
      refused: true,
      error:
        "This request was refused. The generated statement was not a single read-only SELECT, so it was never sent to the database.",
      attempts: [
        {
          n: 1,
          sql: "DELETE FROM customer WHERE country = 'Germany';",
          status: "validation_failed",
          error: "Statement type DELETE is not allowed; only a single SELECT may be executed.",
          duration_ms: 1140,
        },
        {
          n: 2,
          sql: "DELETE FROM customer;",
          status: "validation_failed",
          error: "Statement type DELETE is not allowed; only a single SELECT may be executed.",
          duration_ms: 980,
        },
      ],
    };
  }

  // Scenario 2 — recovers on the second attempt. This is the interesting one.
  if (q.includes("artist") || q.includes("selling") || q.includes("revenue")) {
    return {
      question,
      sql: TOP_ARTISTS_SQL,
      refused: false,
      error: null,
      results: {
        columns: ["artist", "revenue"],
        rows: [
          ["Iron Maiden", 138.6],
          ["U2", 105.93],
          ["Metallica", 90.09],
          ["Led Zeppelin", 86.13],
          ["Lost", 81.59],
        ],
        row_count: 5,
        truncated: false,
      },
      attempts: [
        {
          n: 1,
          sql: `SELECT ar.name, SUM(t.unit_price) AS revenue
FROM artist AS ar
JOIN track AS t ON t.artist_id = ar.artist_id
GROUP BY ar.name
ORDER BY revenue DESC
LIMIT 5;`,
          status: "validation_failed",
          error: 'Unknown column "track.artist_id". Table "track" has no such column.',
          duration_ms: 1320,
        },
        { n: 2, sql: TOP_ARTISTS_SQL, status: "succeeded", error: null, duration_ms: 1610 },
      ],
    };
  }

  // Scenario 3 — clean single-attempt answer.
  const sql = `SELECT COUNT(*) AS customer_count
FROM customer
WHERE country = 'Germany'
LIMIT 100;`;
  return {
    question,
    sql,
    refused: false,
    error: null,
    results: {
      columns: ["customer_count"],
      rows: [[4]],
      row_count: 1,
      truncated: false,
    },
    attempts: [{ n: 1, sql, status: "succeeded", error: null, duration_ms: 1240 }],
  };
}
