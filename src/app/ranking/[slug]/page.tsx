import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { loadRankingPeriod } from "@/lib/data";
import { computeStandings } from "@/lib/standings";
import { periodLabel, type Period, type Ranking } from "@/lib/types";
import { StandingsTable } from "@/components/StandingsTable";
import { MatchRow } from "@/components/MatchRow";

export const dynamic = "force-dynamic";

export default async function RankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { slug } = await params;
  const { periodo } = await searchParams;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: ranking } = await supabase.from("rankings").select("*").eq("slug", slug).maybeSingle<Ranking>();
  if (!ranking) notFound();

  const { data: periodsData } = await supabase
    .from("periods")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);
  const periods = (periodsData ?? []) as Period[];
  const period = periods.find((p) => p.id === periodo) ?? periods.find((p) => p.status === "open") ?? periods[0];

  if (!period) {
    return (
      <div>
        <h1 className="h1 mb-2">Ranking {ranking.name}</h1>
        <p className="card text-sm text-gray-600">Todavía no ha empezado ningún mes.</p>
      </div>
    );
  }

  const { groups, entries, teams, matches } = await loadRankingPeriod(supabase, ranking.id, period.id);
  const closed = period.status === "closed";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Ranking {ranking.name}</h1>
        <p className="text-sm text-gray-500">
          {periodLabel(period)} · {closed ? "Mes cerrado" : "En juego"}
        </p>
      </div>

      {periods.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {periods.map((p) => (
            <Link
              key={p.id}
              href={`/ranking/${slug}?periodo=${p.id}`}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                p.id === period.id ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-700 ring-gray-300"
              }`}
            >
              {periodLabel(p)}
            </Link>
          ))}
        </div>
      )}

      {groups.length === 0 && <p className="card text-sm text-gray-600">Aún no hay grupos.</p>}

      {groups.map((g, idx) => {
        const groupEntries = entries.filter((e) => e.group_id === g.id);
        if (groupEntries.length === 0) return null;
        const groupMatches = matches.filter((m) => m.group_id === g.id);
        const rows = computeStandings(teams, groupEntries, groupMatches);
        return (
          <section key={g.id} className="card">
            <h2 className="h2 mb-2">{g.name}</h2>
            <StandingsTable
              rows={rows}
              highlightTeamId={profile?.team_id}
              closedEntries={closed ? groupEntries : undefined}
              canGoUp={idx > 0}
              canGoDown={idx < groups.length - 1}
            />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                Partidos ({groupMatches.filter((m) => m.status === "confirmed" || m.status === "resolved").length}/
                {groupMatches.length})
              </summary>
              <div className="mt-1">
                {groupMatches.map((m) => (
                  <MatchRow key={m.id} match={m} teams={teams} />
                ))}
              </div>
            </details>
          </section>
        );
      })}

      <p className="text-xs text-gray-500">
        Victoria 3 pts · Derrota 1 pt · No presentado 0 pts. ▲ sube de grupo · ▼ baja de grupo.
      </p>
    </div>
  );
}
