"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/alert";
import { FieldError } from "@/components/field-error";
import type { ProductDetail } from "@/lib/products/service";
import { PRODUCT_LIMITS } from "@/lib/validation/product";

type FormState = {
  description: string;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "published";
};

export function EditorForm({ product }: { product: ProductDetail }) {
  const router = useRouter();

  const initial: FormState = {
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    status: product.status,
  };

  const [form, setForm] = useState<FormState>(initial);
  const [saved, setSaved] = useState<FormState>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        // Deliberately leaves `form` untouched so the user keeps their edits.
        setError(payload?.error?.message ?? "Не вдалося зберегти зміни");
        setFieldErrors(payload?.error?.fieldErrors ?? {});
        return;
      }

      setSaved(form);
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Немає зв'язку з сервером. Зміни не збережено.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">Зміни збережено</Alert> : null}

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="description" className="text-sm font-medium">
            Опис
          </label>
          <span className="text-xs text-gray-500">
            {form.description.length} / {PRODUCT_LIMITS.description}
          </span>
        </div>
        <textarea
          id="description"
          name="description"
          rows={8}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <FieldError messages={fieldErrors.description} />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="seoTitle" className="text-sm font-medium">
            SEO-заголовок
          </label>
          <span className="text-xs text-gray-500">
            {form.seoTitle.length} / {PRODUCT_LIMITS.seoTitle}
          </span>
        </div>
        <input
          id="seoTitle"
          name="seoTitle"
          type="text"
          value={form.seoTitle}
          onChange={(event) => update("seoTitle", event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <FieldError messages={fieldErrors.seoTitle} />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="seoDescription" className="text-sm font-medium">
            SEO-опис
          </label>
          <span className="text-xs text-gray-500">
            {form.seoDescription.length} / {PRODUCT_LIMITS.seoDescription}
          </span>
        </div>
        <textarea
          id="seoDescription"
          name="seoDescription"
          rows={3}
          value={form.seoDescription}
          onChange={(event) => update("seoDescription", event.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <FieldError messages={fieldErrors.seoDescription} />
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium">
          Статус
        </label>
        <select
          id="status"
          name="status"
          value={form.status}
          onChange={(event) => update("status", event.target.value as FormState["status"])}
          className="w-full rounded-md border border-gray-300 px-3 py-2 sm:w-64"
        >
          <option value="draft">Чернетка</option>
          <option value="published">Опубліковано</option>
        </select>
        <FieldError messages={fieldErrors.status} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending || !isDirty}
          className="rounded-md bg-blue-700 px-5 py-2 text-white disabled:opacity-60"
        >
          {pending ? "Зберігаємо…" : "Зберегти"}
        </button>

        {isDirty ? (
          <span className="text-sm text-amber-700">Є незбережені зміни</span>
        ) : null}
      </div>
    </form>
  );
}
