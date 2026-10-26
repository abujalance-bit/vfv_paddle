import Link from "next/link";
import { STATUS_LABEL, type Match, type Team } from "@/lib/types";

const STATUS_STYLE: Record<Match["status"], string> = {
  pending: "bg-white/5 text-muted",
  reported: "bg-amber-400/15 text-amber-300",
  confirmed: "bg-up/15 text-up",
  disputed: "bg-down/15 text-down",
  resolved: "bg-sky-400/15 text-sky-300",
};

export function StatusBadge({ status }: { status: Match["status"] }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Tarjeta tipo marcador: una fila por equipo con sus juegos en cada set
export function MatchRow({ match, teams, href }: { match: Match; teams: Team[]; href?: string }) {
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "¿?";
  const hasScore = match.status !== "pending" && match.result_type === "normal" && match.sets;
  const note =
    match.status === "pending"
      ? null
      : match.result_type === "walkover"
        ? "No presentado"
        : match.result_type === "void"
          ? "Anulado"
          : null;

  const row = (teamId: string, side: 0 | 1) => {
    const won = match.status !== "pending" && match.winner_team_id === teamId;
    return (
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${won ? "bg-lime" : "bg-transparent"}`} />
        <span className={`min-w-0 flex-1 truncate ${won ? "font-bold text-fg" : "text-fg/75"}`}>{name(teamId)}</span>
        {hasScore &&
          match.sets!.map((s, i) => {
            const wonSet = s[side] > s[1 - side];
            return (
              <span
                key={i}
                className={`grid h-7 w-7 place-items-center rounded-lg font-mono text-sm font-bold ${
                  wonSet ? "bg-lime/15 text-lime" : "bg-white/5 text-muted"
                }`}
              >
                {s[side]}
              </span>
            );
          })}
      </div>
    );
  };

  return (
    <Link
      href={href ?? `/partido/${match.id}`}
      className="block space-y-2 rounded-2xl bg-panel-2 p-3 transition active:brightness-125"
    >
      {row(match.home_team_id, 0)}
      {row(match.away_team_id, 1)}
      <div className="flex items-center justify-between pl-3.5 text-xs text-muted">
        <span>
          {match.played_on ? new Date(match.played_on).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""}
          {note && <span className="ml-1 font-semibold text-fg/70">{note}</span>}
        </span>
        <StatusBadge status={match.status} />
      </div>
    </Link>
  );
}
