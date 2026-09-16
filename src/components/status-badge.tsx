import type { ProductStatusValue } from "@/lib/products/service";

const LABELS: Record<ProductStatusValue, string> = {
  draft: "Чернетка",
  published: "Опубліковано",
};

const STYLES: Record<ProductStatusValue, string> = {
  draft: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status }: { status: ProductStatusValue }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
