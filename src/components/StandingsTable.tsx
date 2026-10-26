import Link from "next/link";
import type { StandingRow } from "@/lib/standings";
import type { GroupEntry } from "@/lib/types";

type Props = {
  rows: StandingRow[];
  highlightTeamId?: string | null;
  // Si la fase está cerrada, se muestra el movimiento real; si está abierto, la previsión
  closedEntries?: GroupEntry[];
  canGoUp: boolean;
  canGoDown: boolean;
  // Marca los empates pendientes de desempate manual (solo en el panel de cierre)
  showTies?: boolean;
  linkTeams?: boolean;
};

const BAR = { up: "bg-up", down: "bg-down", stay: "bg-muted/50" };

export function StandingsTable({ rows, highlightTeamId, closedEntries, canGoUp, canGoDown, showTies, linkTeams }: Props) {
  const anyPlayed = rows.some((x) => x.played > 0);

  return (
    <div>
      <div className="grid grid-cols-[1.5rem_1fr_repeat(4,1.6rem)_2.25rem] sm:grid-cols-[2rem_1fr_repeat(4,2.5rem)_3rem] items-center gap-1 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span>#</span>
        <span>Equipo</span>
        <span className="text-center">PJ</span>
        <span className="text-center">G</span>
        <span className="text-center">P</span>
        <span className="text-center">Sets</span>
        <span className="text-center">Pts</span>
      </div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => {
          let movement: "up" | "down" | "stay" = "stay";
          if (closedEntries) {
            movement = closedEntries.find((e) => e.team_id === r.team.id)?.movement ?? "stay";
          } else if (rows.length >= 2 && anyPlayed) {
            if (i === 0 && canGoUp) movement = "up";
            if (i === rows.length - 1 && canGoDown) movement = "down";
          }
          const setsDiff = r.setsFor - r.setsAgainst;
          const mine = r.team.id === highlightTeamId;
          const content = (
            <>
              <span className={`absolute inset-y-2 left-0 w-1.5 rounded-full ${BAR[movement]}`} />
              <span className="pl-2 font-mono text-sm text-muted">{i + 1}</span>
              <span className="min-w-0 font-semibold leading-tight line-clamp-2">
                {r.team.name}
                {r.unresolvedTie && showTies && (
                  <span className="ml-1.5 rounded bg-amber-400/15 px-1 text-[10px] font-bold text-amber-300">EMPATE</span>
                )}
              </span>
              <span className="text-center text-sm text-muted">{r.played}</span>
              <span className="text-center text-sm text-muted">{r.won}</span>
              <span className="text-center text-sm text-muted">{r.lost}</span>
              <span className="text-center text-sm text-muted">{setsDiff > 0 ? `+${setsDiff}` : setsDiff}</span>
              <span className={`text-center font-display text-lg font-black ${i === 0 && anyPlayed ? "text-lime" : ""}`}>
                {r.points}
              </span>
            </>
          );
          const cls = `relative grid grid-cols-[1.5rem_1fr_repeat(4,1.6rem)_2.25rem] sm:grid-cols-[2rem_1fr_repeat(4,2.5rem)_3rem] items-center gap-1 rounded-2xl px-2 py-3 ${
            mine ? "bg-lime/10 ring-1 ring-lime/40" : "bg-panel-2"
          }`;
          return (
            <li key={r.team.id}>
              {linkTeams ? (
                <Link href={`/equipo/${r.team.id}`} className={`${cls} transition active:brightness-125`}>
                  {content}
                </Link>
              ) : (
                <div className={cls}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
