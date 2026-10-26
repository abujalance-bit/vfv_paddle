import type { GroupEntry, Match, Team } from "@/lib/types";

export const POINTS_WIN = 3;
export const POINTS_LOSS = 1;

export type StandingRow = {
  team: Team;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  tiebreak: number | null;
  // Empatado a puntos con otro equipo y el admin aún no ha fijado el orden
  unresolvedTie: boolean;
};

export const isCounted = (m: Match) => m.status === "confirmed" || m.status === "resolved";

export function computeStandings(teams: Team[], entries: GroupEntry[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const e of entries) {
    const team = teams.find((t) => t.id === e.team_id);
    if (!team) continue;
    rows.set(team.id, {
      team,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      setsFor: 0,
      setsAgainst: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      tiebreak: e.tiebreak,
      unresolvedTie: false,
    });
  }

  for (const m of matches) {
    if (!isCounted(m) || m.result_type === "void") continue;
    const home = rows.get(m.home_team_id);
    const away = rows.get(m.away_team_id);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    const [winner, loser] = m.winner_team_id === m.home_team_id ? [home, away] : [away, home];
    winner.won++;
    loser.lost++;
    winner.points += POINTS_WIN;
    if (m.result_type === "normal") {
      loser.points += POINTS_LOSS;
      for (const [h, a] of m.sets ?? []) {
        home.gamesFor += h;
        home.gamesAgainst += a;
        away.gamesFor += a;
        away.gamesAgainst += h;
        if (h > a) {
          home.setsFor++;
          away.setsAgainst++;
        } else {
          away.setsFor++;
          home.setsAgainst++;
        }
      }
    }
  }

  const list = [...rows.values()];
  list.sort(
    (a, b) =>
      b.points - a.points ||
      (a.tiebreak ?? 99) - (b.tiebreak ?? 99) ||
      b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
      b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst) ||
      a.team.name.localeCompare(b.team.name),
  );

  const byPoints = new Map<number, StandingRow[]>();
  for (const r of list) byPoints.set(r.points, [...(byPoints.get(r.points) ?? []), r]);
  for (const cluster of byPoints.values()) {
    if (cluster.length < 2) continue;
    const tb = cluster.map((r) => r.tiebreak);
    const unresolved = tb.some((v) => v === null) || new Set(tb).size < tb.length;
    if (unresolved) cluster.forEach((r) => (r.unresolvedTie = true));
  }

  return list;
}

// Solo bloquea el cierre un empate que decide quién sube o quién baja
export function hasBlockingTie(rows: StandingRow[]) {
  if (rows.length < 2) return false;
  return rows[0].unresolvedTie || rows[rows.length - 1].unresolvedTie;
}
