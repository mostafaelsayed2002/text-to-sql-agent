import type { Config } from "tailwindcss";

const config: Config = {
  // Theme is driven by a `dark` class on <html>, set by the toggle / the
  // pre-paint script in app/layout.tsx — not by prefers-color-scheme directly.
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
