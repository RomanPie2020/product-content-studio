import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Product Content Studio",
  description: "Редактор товарних карток",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
