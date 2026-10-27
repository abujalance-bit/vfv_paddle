import { daysLeftLabel, formatDay, type Period } from "@/lib/types";

// Etiqueta "Quedan 18 días · termina el 14 nov"
export function PhaseCountdown({ period, className = "" }: { period: Period; className?: string }) {
  const closed = period.status === "closed";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
        closed ? "bg-white/10 text-muted" : "bg-lime text-ink"
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
        <path d="M5 22h14" />
        <path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </svg>
      {daysLeftLabel(period)}
      {!closed && <span className="font-semibold opacity-70">· termina el {formatDay(period.end_date)}</span>}
    </span>
  );
}
