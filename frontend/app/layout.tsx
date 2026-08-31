import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text-to-SQL Agent",
  description:
    "Ask a question in plain English; the model writes the SQL, a validator decides whether it is safe to run.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
