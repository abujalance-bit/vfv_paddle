import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getOpenPeriod } from "@/lib/data";
import { computeStandings } from "@/lib/standings";
import {
  captainLabel,
  periodLabel,
  type Group,
  type GroupEntry,
  type Match,
  type Period,
  type Player,
  type Ranking,
  type Team,
} from "@/lib/types";
import { MatchRow } from "@/components/MatchRow";
import { PhaseCountdown } from "@/components/PhaseCountdown";
import { ArrowLeftIcon, BellIcon, ChevronDownIcon, ChevronUpIcon, MinusIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: team } = await supabase.from("teams").select("*").eq("id", id).maybeSingle<Team>();
  if (!team) notFound();

  const open = await getOpenPeriod(supabase);
  const [{ data: ranking }, { data: playersData }, { data: historyData }, { data: periodsData }, { data: groupsData }] =
    await Promise.all([
      supabase.from("rankings").select("*").eq("id", team.ranking_id).single<Ranking>(),
      supabase.from("players").select("*").eq("team_id", id).order("position"),
      supabase.from("group_entries").select("*").eq("team_id", id),
      supabase.from("periods").select("*"),
      supabase.from("groups").select("*").eq("ranking_id", team.ranking_id),
    ]);
  const players = (playersData ?? []) as Player[];
  const history = (historyData ?? []) as GroupEntry[];
  const periods = (periodsData ?? []) as Period[];
  const groups = (groupsData ?? []) as Group[];

  // Fase actual: la abierta si el equipo juega en ella, si no la última en la que jugó
  const sortedHistory = history
    .map((e) => ({ entry: e, period: periods.find((p) => p.id === e.period_id)! }))
    .filter((x) => x.period)
    .sort((a, b) => b.period.start_date.localeCompare(a.period.start_date));
  const current = sortedHistory.find((x) => x.period.id === open?.id) ?? sortedHistory[0];

  let groupTeams: Team[] = [];
  let groupMatches: Match[] = [];
  let position: number | null = null;
  let points = 0;
  if (current) {
    const [{ data: entriesData }, { data: matchesData }] = await Promise.all([
      supabase.from("group_entries").select("*").eq("period_id", current.period.id).eq("group_id", current.entry.group_id),
      supabase.from("matches").select("*").eq("period_id", current.period.id).eq("group_id", current.entry.group_id),
    ]);
    const entries = (entriesData ?? []) as GroupEntry[];
    groupMatches = (matchesData ?? []) as Match[];
    const { data: teamsData } = await supabase.from("teams").select("*").in("id", entries.map((e) => e.team_id));
    groupTeams = (teamsData ?? []) as Team[];
    const rows = computeStandings(groupTeams, entries, groupMatches);
    const idx = rows.findIndex((r) => r.team.id === id);
    position = idx >= 0 ? idx + 1 : null;
    points = rows[idx]?.points ?? 0;
  }

  const myMatches = groupMatches.filter((m) => m.home_team_id === id || m.away_team_id === id);
  const isMine = profile?.team_id === id;
  const toConfirm = isMine ? myMatches.filter((m) => m.status === "reported" && m.reported_by_team_id !== id) : [];
  const currentGroup = groups.find((g) => g.id === current?.entry.group_id);

  return (
    <div className="space-y-5">
      <Link href={`/?r=${ranking?.slug ?? ""}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted">
        <ArrowLeftIcon className="h-4 w-4" /> Clasificación
      </Link>

      <section className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-panel-2 to-panel p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime/10 blur-2xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
          {ranking?.name} {currentGroup && `· ${currentGroup.name}`}
        </p>
        <h1 className="mt-1 font-display text-4xl font-black uppercase leading-none tracking-tight">{team.name}</h1>
        {isMine && <span className="mt-2 inline-block rounded-full bg-lime px-2.5 py-0.5 text-xs font-black text-ink">TU EQUIPO</span>}
        {current && current.period.status === "open" && (
          <div className="relative mt-4">
            <PhaseCountdown period={current.period} />
          </div>
        )}
        {current && (
          <dl className="relative mt-6 flex gap-8">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Posición</dt>
              <dd className="mt-1 font-mono text-4xl font-bold">{position ?? "–"}º</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Puntos</dt>
              <dd className="mt-1 font-mono text-4xl font-bold text-lime">{points}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Fase</dt>
              <dd className="mt-2 text-sm font-semibold">{periodLabel(current.period)}</dd>
            </div>
          </dl>
        )}
      </section>

      {toConfirm.length > 0 && (
        <section className="space-y-2 rounded-3xl bg-lime/10 p-4 ring-1 ring-lime/40">
          <h2 className="flex items-center gap-2 font-bold text-lime">
            <BellIcon className="h-5 w-5" /> Resultados por confirmar
          </h2>
          <p className="text-sm text-fg/80">El equipo rival ha subido estos resultados. Ábrelos para confirmarlos.</p>
          {toConfirm.map((m) => (
            <MatchRow key={m.id} match={m} teams={groupTeams} />
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="h2 mb-3">Componentes</h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {players.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-panel-2 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime/15 font-display font-black text-lime">
                {p.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{p.name}</span>
                {i === 0 && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-lime">{captainLabel(ranking?.slug)}</span>
                )}
              </span>
            </li>
          ))}
          {players.length === 0 && <li className="text-sm text-muted">Sin jugadores.</li>}
        </ul>
      </section>

      {current && (
        <section className="card space-y-2">
          <h2 className="h2 mb-1">Partidos · {periodLabel(current.period)}</h2>
          {myMatches.map((m) => (
            <MatchRow key={m.id} match={m} teams={groupTeams} />
          ))}
          {myMatches.length === 0 && <p className="text-sm text-muted">Sin partidos.</p>}
          {isMine && myMatches.some((m) => m.status === "pending") && (
            <p className="pt-1 text-xs text-muted">Toca un partido pendiente para subir el resultado.</p>
          )}
        </section>
      )}

      {sortedHistory.some((x) => x.period.status === "closed") && (
        <section className="card">
          <h2 className="h2 mb-3">Historial</h2>
          <ul className="space-y-1.5">
            {sortedHistory
              .filter((x) => x.period.status === "closed")
              .map(({ entry, period }) => (
                <li key={period.id} className="flex items-center gap-3 rounded-2xl bg-panel-2 px-3 py-2.5 text-sm">
                  <span className="flex-1 font-semibold">{periodLabel(period)}</span>
                  <span className="text-muted">{groups.find((g) => g.id === entry.group_id)?.name}</span>
                  <span className="w-8 text-right font-mono font-bold">{entry.final_position ?? "–"}º</span>
                  {entry.movement === "up" && <ChevronUpIcon className="h-4 w-4 text-up" />}
                  {entry.movement === "down" && <ChevronDownIcon className="h-4 w-4 text-down" />}
                  {(entry.movement === "stay" || !entry.movement) && <MinusIcon className="h-4 w-4 text-muted" />}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
