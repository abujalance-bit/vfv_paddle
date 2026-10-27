export type Ranking = { id: number; name: string; slug: string };

export type Group = { id: string; ranking_id: number; name: string; level: number };

export type Team = { id: string; ranking_id: number; name: string; active: boolean };

export type Player = { id: string; team_id: string; name: string; position: number };

export type Period = {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  // planned: programada (aún no empieza) | open: en juego | closed: cerrada
  status: "planned" | "open" | "closed";
  visible: boolean;
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

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Las fechas van como texto YYYY-MM-DD para no depender de la zona horaria
function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

export function formatDay(iso: string, withYear = false) {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS_SHORT[m - 1]}${withYear ? ` ${y}` : ""}`;
}

// "19 oct – 14 nov 2026" (o con los dos años si cambia de año)
export function periodLabel(p: Pick<Period, "start_date" | "end_date">) {
  const sameYear = parts(p.start_date).y === parts(p.end_date).y;
  return `${formatDay(p.start_date, !sameYear)} – ${formatDay(p.end_date, true)}`;
}

export function addDays(iso: string, days: number) {
  const { y, m, d } = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = parts(fromIso);
  const b = parts(toIso);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

// Fecha de hoy en España, YYYY-MM-DD
export function todayMadrid() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

// "Quedan 18 días", "Último día", "Terminada"
export function daysLeftLabel(p: Pick<Period, "start_date" | "end_date" | "status">) {
  if (p.status === "closed") return "Fase cerrada";
  const today = todayMadrid();
  if (today < p.start_date) return `Empieza en ${daysBetween(today, p.start_date)} días`;
  const left = daysBetween(today, p.end_date);
  if (left < 0) return "Plazo terminado";
  if (left === 0) return "Último día";
  return left === 1 ? "Queda 1 día" : `Quedan ${left} días`;
}

export const AUTO_CONFIRM_DAYS = 2;

export const PERIOD_STATUS_LABEL: Record<Period["status"], string> = {
  planned: "Programada",
  open: "En juego",
  closed: "Cerrada",
};

// Capitán o capitana según la categoría
export const captainLabel = (rankingSlug?: string) => (rankingSlug === "femenino" ? "Capitana" : "Capitán");

export const STATUS_LABEL: Record<MatchStatus, string> = {
  pending: "Por jugar",
  reported: "Por confirmar",
  confirmed: "Confirmado",
  disputed: "En revisión",
  resolved: "Resuelto por admin",
};
