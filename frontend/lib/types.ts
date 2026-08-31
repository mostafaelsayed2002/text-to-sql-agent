/**
 * The API contract between this frontend and the FastAPI backend.
 *
 * These types are the specification: the backend's response models must match
 * them exactly. The mock routes under app/api/mock implement the same shapes,
 * so the UI can be developed and demoed before the backend exists.
 */

/** Why a single generate-validate-execute attempt ended. */
export type AttemptStatus =
  /** The model returned SQL the validator refused (not a single SELECT, unknown column, ...). */
  | "validation_failed"
  /** The SQL passed validation but Postgres rejected it (bad cast, timeout, ...). */
  | "execution_failed"
  /** SQL validated and executed; this is the answer. */
  | "succeeded";

/** One pass through the retry loop. The frontend renders these as the trace. */
export interface Attempt {
  /** 1-based attempt number. */
  n: number;
  /** SQL the model produced, fences already stripped. Null if the model returned nothing usable. */
  sql: string | null;
  status: AttemptStatus;
  /** Human-readable reason this attempt failed; null when status is "succeeded". */
  error: string | null;
  /** Wall-clock duration of the attempt, milliseconds. */
  duration_ms: number;
}

/** A result set, shaped for direct table rendering. */
export interface QueryResults {
  columns: string[];
  /** Row-major values, aligned to `columns`. */
  rows: Array<Array<string | number | boolean | null>>;
  /** Number of rows returned (rows.length; explicit so the UI never has to infer it). */
  row_count: number;
  /** True when the validator's enforced LIMIT clipped the result set. */
  truncated: boolean;
}

/** POST /query response. */
export interface QueryResponse {
  /** Echoed back so a late response can be matched to its question. */
  question: string;
  /** The SQL that finally succeeded. Null when every attempt failed. */
  sql: string | null;
  /** Null when every attempt failed. */
  results: QueryResults | null;
  /** Every attempt, in order. Always at least one entry. */
  attempts: Attempt[];
  /**
   * Set when the request produced no answer. The frontend shows this verbatim,
   * so it must be safe and meaningful to a visitor.
   */
  error: string | null;
  /** True when the request stopped because the validator refused, rather than a DB error. */
  refused: boolean;
}

/** POST /query request body. */
export interface QueryRequest {
  question: string;
}

export interface SchemaColumn {
  name: string;
  /** Postgres type name, e.g. "integer", "character varying". */
  type: string;
  nullable: boolean;
  primary_key: boolean;
  /** Present when this column is a foreign key. */
  references: { table: string; column: string } | null;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

/** GET /schema response. */
export interface SchemaResponse {
  tables: SchemaTable[];
}
