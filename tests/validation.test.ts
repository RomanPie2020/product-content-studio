import { describe, expect, it } from "vitest";
import { PRODUCT_LIMITS, productContentSchema } from "@/lib/validation/product";
import { formatFieldErrors } from "@/lib/validation/errors";

const valid = {
  description: "Опис товару",
  seoTitle: "SEO заголовок",
  seoDescription: "SEO опис",
  status: "published" as const,
};

describe("productContentSchema", () => {
  it("accepts valid content", () => {
    expect(productContentSchema.safeParse(valid).success).toBe(true);
  });

  it("exposes the limits required by the task", () => {
    expect(PRODUCT_LIMITS).toEqual({ description: 1000, seoTitle: 60, seoDescription: 160 });
  });

  it.each([
    ["description", 1000],
    ["seoTitle", 60],
    ["seoDescription", 160],
  ])("accepts %s at exactly %i characters", (field, max) => {
    const result = productContentSchema.safeParse({ ...valid, [field]: "я".repeat(max) });
    expect(result.success).toBe(true);
  });

  it.each([
    ["description", 1001],
    ["seoTitle", 61],
    ["seoDescription", 161],
  ])("rejects %s at %i characters", (field, length) => {
    const result = productContentSchema.safeParse({ ...valid, [field]: "я".repeat(length) });
    expect(result.success).toBe(false);
  });

  it.each(["description", "seoTitle", "seoDescription"])("rejects an empty %s", (field) => {
    expect(productContentSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
  });

  it.each(["description", "seoTitle", "seoDescription"])(
    "rejects a whitespace-only %s",
    (field) => {
      expect(productContentSchema.safeParse({ ...valid, [field]: "   \n\t " }).success).toBe(false);
    },
  );

  it("trims surrounding whitespace before storing", () => {
    const result = productContentSchema.safeParse({ ...valid, description: "  Опис  " });
    expect(result.success && result.data.description).toBe("Опис");
  });

  it("rejects an unknown status", () => {
    expect(productContentSchema.safeParse({ ...valid, status: "archived" }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    const { seoTitle, ...withoutSeoTitle } = valid;
    expect(productContentSchema.safeParse(withoutSeoTitle).success).toBe(false);
  });

  it("ignores attempts to set read-only fields", () => {
    const result = productContentSchema.safeParse({ ...valid, name: "Хакер", id: "x" });
    expect(result.success).toBe(true);
    expect(result.success && "name" in result.data).toBe(false);
  });
});

describe("formatFieldErrors", () => {
  it("groups messages by field name", () => {
    const result = productContentSchema.safeParse({ ...valid, seoTitle: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatFieldErrors(result.error);
      expect(errors.seoTitle?.length).toBeGreaterThan(0);
    }
  });
});
