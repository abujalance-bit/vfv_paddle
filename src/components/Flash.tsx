export type FlashParams = { error?: string; ok?: string };

export function Flash({ error, ok }: FlashParams) {
  if (error) {
    return <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">{error}</div>;
  }
  if (ok) {
    return <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-100">{ok}</div>;
  }
  return null;
}
