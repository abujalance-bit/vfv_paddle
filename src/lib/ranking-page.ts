import { createClient } from "@/lib/supabase/server";
import { getPeriods, getRankings, loadRankingPeriod, type RankingPeriodData } from "@/lib/data";

export type RankingSearchParams = { r?: string; periodo?: string };

const EMPTY: RankingPeriodData = { groups: [], entries: [], teams: [], matches: [] };

// Datos comunes de Clasificación y Resultados: ranking elegido (?r=), fase (?periodo=) y su contenido
export async function loadRankingPage({ r, periodo }: RankingSearchParams) {
  const supabase = await createClient();
  const rankings = await getRankings(supabase);
  const ranking = rankings.find((x) => x.slug === r) ?? rankings[0];
  const { periods, period } = await getPeriods(supabase, periodo);
  const data = period && ranking ? await loadRankingPeriod(supabase, ranking.id, period.id) : EMPTY;
  // Solo los grupos que tienen equipos ese mes, en orden de nivel
  const groups = data.groups.filter((g) => data.entries.some((e) => e.group_id === g.id));
  return { supabase, rankings, ranking, periods, period, ...data, groups };
}
