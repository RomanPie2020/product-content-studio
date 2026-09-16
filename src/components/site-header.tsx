import Link from "next/link";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          Product Content Studio
        </Link>
        <div className="flex items-center gap-4 text-sm">{children}</div>
      </div>
    </header>
  );
}
