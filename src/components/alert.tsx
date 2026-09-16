const TONES = {
  error: "border-red-300 bg-red-50 text-red-800",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
} as const;

export function Alert({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <div role="alert" className={`rounded-md border px-4 py-3 text-sm ${TONES[tone]}`}>
      {children}
    </div>
  );
}
