import { isCounted } from "@/lib/standings";
import { loadRankingPage, type RankingSearchParams } from "@/lib/ranking-page";
import type { Match } from "@/lib/types";
import { RankingFilters } from "@/components/RankingFilters";
import { MatchRow } from "@/components/MatchRow";
import { PhaseCountdown } from "@/components/PhaseCountdown";

export const dynamic = "force-dynamic";

// Jugados primero (más recientes arriba), luego los pendientes
const byRecency = (a: Match, b: Match) =>
  Number(b.status !== "pending") - Number(a.status !== "pending") ||
  (b.played_on ?? "").localeCompare(a.played_on ?? "");

export default async function ResultsPage({ searchParams }: { searchParams: Promise<RankingSearchParams> }) {
  const params = await searchParams;
  const { rankings, ranking, periods, period, groups, teams, matches } = await loadRankingPage(params);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1 text-3xl">Resultados</h1>
        <p className="text-sm text-muted">
          {matches.filter(isCounted).length} de {matches.length} partidos jugados
        </p>
        {period && <PhaseCountdown period={period} className="mt-3" />}
      </div>

      {ranking && <RankingFilters basePath="/resultados" rankings={rankings} ranking={ranking} periods={periods} period={period} />}

      {groups.length === 0 && <p className="card text-center text-sm text-muted">No hay partidos para esta fase.</p>}

      {groups.map((g) => {
        const list = matches.filter((m) => m.group_id === g.id).sort(byRecency);
        return (
          <section key={g.id} className="card space-y-2">
            <h2 className="h2 mb-1 text-lg">{g.name}</h2>
            {list.map((m) => (
              <MatchRow key={m.id} match={m} teams={teams} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
