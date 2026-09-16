import { z } from "zod";

export const PRODUCT_LIMITS = {
  description: 1000,
  seoTitle: 60,
  seoDescription: 160,
} as const;

function boundedText(max: number, label: string) {
  return z
    .string({ message: `${label}: обов'язкове поле` })
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: `${label}: поле не може бути порожнім` })
    .refine((value) => value.length <= max, {
      message: `${label}: максимум ${max} символів`,
    });
}

export const productStatusSchema = z.enum(["draft", "published"], {
  message: "Статус має бути draft або published",
});

export const productContentSchema = z.object({
  description: boundedText(PRODUCT_LIMITS.description, "Опис"),
  seoTitle: boundedText(PRODUCT_LIMITS.seoTitle, "SEO-заголовок"),
  seoDescription: boundedText(PRODUCT_LIMITS.seoDescription, "SEO-опис"),
  status: productStatusSchema,
});

export type ProductContentInput = z.infer<typeof productContentSchema>;
