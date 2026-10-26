import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { computeStandings, isCounted } from "@/lib/standings";
import { loadRankingPage, type RankingSearchParams } from "@/lib/ranking-page";
import type { Announcement } from "@/lib/types";
import { Hero } from "@/components/Hero";
import { RankingFilters } from "@/components/RankingFilters";
import { StandingsTable } from "@/components/StandingsTable";
import { BellIcon, MegaphoneIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function ClassificationPage({ searchParams }: { searchParams: Promise<RankingSearchParams> }) {
  const params = await searchParams;
  const profile = await getProfile();
  const { supabase, rankings, ranking, periods, period, groups, entries, teams, matches } = await loadRankingPage(params);
  const closed = period?.status === "closed";

  const { data: annData } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);
  const announcements = (annData ?? []) as Announcement[];

  let toConfirm = 0;
  if (profile?.team_id && period?.status === "open") {
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("period_id", period.id)
      .eq("status", "reported")
      .neq("reported_by_team_id", profile.team_id)
      .or(`home_team_id.eq.${profile.team_id},away_team_id.eq.${profile.team_id}`);
    toConfirm = count ?? 0;
  }

  return (
    <div className="space-y-5">
      <Hero
        subtitle="Pincha en cualquier equipo para ver sus componentes y partidos. El 1º asciende, el último desciende."
        stats={[
          { label: "Grupos", value: groups.length },
          { label: "Equipos", value: entries.length },
          { label: "Partidos", value: matches.filter(isCounted).length },
        ]}
      />

      {toConfirm > 0 && profile?.team_id && (
        <Link
          href={`/equipo/${profile.team_id}`}
          className="flex items-center gap-3 rounded-3xl bg-lime p-4 font-semibold text-ink"
        >
          <BellIcon className="h-6 w-6 shrink-0" />
          <span>
            Tienes {toConfirm} resultado{toConfirm > 1 ? "s" : ""} por confirmar. Toca aquí para revisarlo
            {toConfirm > 1 ? "s" : ""}.
          </span>
        </Link>
      )}

      {announcements.length > 0 && (
        <section className="space-y-2">
          {announcements.map((a) => (
            <article key={a.id} className="flex gap-3 rounded-3xl border border-line bg-panel p-4">
              <MegaphoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-lime" />
              <div className="min-w-0">
                <h3 className="font-bold">{a.title}</h3>
                {a.body && <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>}
              </div>
            </article>
          ))}
        </section>
      )}

      {ranking && (
        <RankingFilters basePath="/" rankings={rankings} ranking={ranking} periods={periods} period={period} showLegend />
      )}

      {!period && <Empty text="Todavía no ha empezado ninguna fase." />}
      {period && groups.length === 0 && <Empty text="Aún no hay equipos en este ranking para esta fase." />}

      {groups.map((g, idx) => {
        const rows = computeStandings(
          teams,
          entries.filter((e) => e.group_id === g.id),
          matches.filter((m) => m.group_id === g.id),
        );
        return (
          <section key={g.id} className="card">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="h2 text-lg">{g.name}</h2>
              <span className="text-xs text-muted">
                {matches.filter((m) => m.group_id === g.id && isCounted(m)).length}/
                {matches.filter((m) => m.group_id === g.id).length} partidos
              </span>
            </div>
            <StandingsTable
              rows={rows}
              highlightTeamId={profile?.team_id}
              closedEntries={closed ? entries.filter((e) => e.group_id === g.id) : undefined}
              canGoUp={idx > 0}
              canGoDown={idx < groups.length - 1}
              linkTeams
            />
          </section>
        );
      })}

      <p className="text-center text-xs text-muted">Victoria 3 pts · Derrota 1 pt · No presentado 0 pts</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="card text-center text-sm text-muted">{text}</p>;
}
