export type FlashParams = { error?: string; ok?: string };

export function Flash({ error, ok }: FlashParams) {
  if (error) {
    return <div className="mb-4 rounded-xl bg-down/10 px-4 py-3 text-sm text-down ring-1 ring-down/40">{error}</div>;
  }
  if (ok) {
    return <div className="mb-4 rounded-xl bg-lime/10 px-4 py-3 text-sm text-lime ring-1 ring-lime/30">{ok}</div>;
  }
  return null;
}
