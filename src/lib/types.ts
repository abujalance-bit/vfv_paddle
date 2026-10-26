export type Ranking = { id: number; name: string; slug: string };

export type Group = { id: string; ranking_id: number; name: string; level: number };

export type Team = { id: string; ranking_id: number; name: string; active: boolean };

export type Player = { id: string; team_id: string; name: string; position: number };

export type Period = {
  id: string;
  year: number;
  month: number;
  status: "open" | "closed";
  closed_at: string | null;
};

export type GroupEntry = {
  period_id: string;
  group_id: string;
  team_id: string;
  tiebreak: number | null;
  final_position: number | null;
  movement: "up" | "down" | "stay" | null;
};

export type MatchStatus = "pending" | "reported" | "confirmed" | "disputed" | "resolved";

export type Match = {
  id: string;
  period_id: string;
  group_id: string;
  home_team_id: string;
  away_team_id: string;
  status: MatchStatus;
  result_type: "normal" | "walkover" | "void";
  sets: [number, number][] | null;
  winner_team_id: string | null;
  home_players: string[] | null;
  away_players: string[] | null;
  played_on: string | null;
  reported_by_team_id: string | null;
  reported_at: string | null;
  confirmed_at: string | null;
  dispute_reason: string | null;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function periodLabel(p: Pick<Period, "year" | "month">) {
  return `${MONTHS[p.month - 1]} ${p.year}`;
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  pending: "Por jugar",
  reported: "Por confirmar",
  confirmed: "Confirmado",
  disputed: "En revisión",
  resolved: "Resuelto por admin",
};
