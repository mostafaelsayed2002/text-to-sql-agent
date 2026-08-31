import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text-to-SQL Agent",
  description:
    "Ask a question in plain English; the model writes the SQL, a validator decides whether it is safe to run.",
};

/**
 * Runs before first paint, so the page never flashes the wrong theme.
 *
 * A stored choice always wins; the OS preference is only the default for a
 * visitor who has not pressed the toggle yet. Kept in sync with
 * THEME_STORAGE_KEY in components/ThemeToggle.tsx.
 */
const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {
    // Blocked storage: fall through to the light default.
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT mutates <html>'s class list before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
