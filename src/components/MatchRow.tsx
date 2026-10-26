import Link from "next/link";
import { formatResult } from "@/lib/sets";
import { STATUS_LABEL, type Match, type Team } from "@/lib/types";

const STATUS_STYLE: Record<Match["status"], string> = {
  pending: "bg-gray-100 text-gray-700",
  reported: "bg-amber-100 text-amber-800",
  confirmed: "bg-brand-100 text-brand-700",
  disputed: "bg-red-100 text-red-800",
  resolved: "bg-blue-100 text-blue-800",
};

export function StatusBadge({ status }: { status: Match["status"] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function MatchRow({ match, teams, href }: { match: Match; teams: Team[]; href?: string }) {
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "¿?";
  const hasResult = match.status !== "pending";
  const winner = match.winner_team_id;

  return (
    <Link
      href={href ?? `/partido/${match.id}`}
      className="flex items-center justify-between gap-2 border-t border-gray-100 py-2.5 text-sm active:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <div className={`truncate ${winner === match.home_team_id ? "font-semibold" : ""}`}>
          {name(match.home_team_id)}
        </div>
        <div className={`truncate ${winner === match.away_team_id ? "font-semibold" : ""}`}>
          {name(match.away_team_id)}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {hasResult && <span className="font-mono text-xs">{formatResult(match)}</span>}
        <StatusBadge status={match.status} />
      </div>
    </Link>
  );
}
