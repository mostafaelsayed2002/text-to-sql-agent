import { Fragment } from "react";

/**
 * Minimal SQL syntax highlighter.
 *
 * A dependency-free tokenizer rather than react-syntax-highlighter/Shiki: the page
 * renders a handful of short SQL snippets, and neither library earns its bundle
 * weight for that. Swap in Shiki here if the need grows — nothing else imports it.
 */

const KEYWORDS = new Set(
  `select from where group by order having limit offset join inner left right full outer on
   as and or not in is null distinct count sum avg min max round case when then else end
   union all asc desc with cast between like ilike exists`
    .split(/\s+/)
    .filter(Boolean),
);

type TokenKind = "keyword" | "string" | "number" | "comment" | "punct" | "plain";

const CLASS_FOR: Record<TokenKind, string> = {
  keyword: "text-violet-700 dark:text-violet-300 font-medium",
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  comment: "text-slate-400 dark:text-slate-500 italic",
  punct: "text-slate-400 dark:text-slate-500",
  plain: "",
};

/** Ordered so that longer/greedier patterns win; every branch is a named group. */
const TOKEN_RE =
  /(?<comment>--[^\n]*)|(?<string>'(?:[^']|'')*')|(?<number>\b\d+(?:\.\d+)?\b)|(?<word>[A-Za-z_][A-Za-z0-9_]*)|(?<punct>[(),;.*=<>+\-/|]+)/g;

function classify(match: RegExpExecArray): TokenKind {
  const g = match.groups ?? {};
  if (g.comment) return "comment";
  if (g.string) return "string";
  if (g.number) return "number";
  if (g.punct) return "punct";
  if (g.word) return KEYWORDS.has(g.word.toLowerCase()) ? "keyword" : "plain";
  return "plain";
}

function tokenize(sql: string) {
  const out: Array<{ text: string; kind: TokenKind }> = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;

  for (let m = TOKEN_RE.exec(sql); m !== null; m = TOKEN_RE.exec(sql)) {
    if (m.index > last) out.push({ text: sql.slice(last, m.index), kind: "plain" });
    out.push({ text: m[0], kind: classify(m) });
    last = m.index + m[0].length;
  }
  if (last < sql.length) out.push({ text: sql.slice(last), kind: "plain" });
  return out;
}

export function SqlBlock({ sql, className = "" }: { sql: string; className?: string }) {
  return (
    <pre
      className={`overflow-x-auto rounded-lg bg-slate-50 p-4 font-mono text-[13px] leading-relaxed dark:bg-slate-900/70 ${className}`}
    >
      <code>
        {tokenize(sql).map((token, i) => (
          <Fragment key={i}>
            <span className={CLASS_FOR[token.kind]}>{token.text}</span>
          </Fragment>
        ))}
      </code>
    </pre>
  );
}
