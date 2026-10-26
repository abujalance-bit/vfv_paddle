import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getPeriods, getRankings, loadRankingPeriod, type RankingPeriodData } from "@/lib/data";

export type RankingSearchParams = { r?: string; periodo?: string };

const EMPTY: RankingPeriodData = { groups: [], entries: [], teams: [], matches: [] };

// Datos comunes de Clasificación y Resultados: ranking elegido (?r=), fase (?periodo=) y su contenido.
// Sin ?r= se muestra la categoría del equipo que ha entrado.
export async function loadRankingPage({ r, periodo }: RankingSearchParams) {
  const supabase = await createClient();
  const profile = await getProfile();
  const rankings = await getRankings(supabase);

  let myRankingId: number | null = null;
  if (!r && profile?.team_id) {
    const { data } = await supabase.from("teams").select("ranking_id").eq("id", profile.team_id).maybeSingle();
    myRankingId = data?.ranking_id ?? null;
  }
  const ranking = rankings.find((x) => x.slug === r) ?? rankings.find((x) => x.id === myRankingId) ?? rankings[0];

  const { periods, period } = await getPeriods(supabase, periodo);
  const data = period && ranking ? await loadRankingPeriod(supabase, ranking.id, period.id) : EMPTY;
  // Solo los grupos que tienen equipos esa fase, en orden de nivel
  const groups = data.groups.filter((g) => data.entries.some((e) => e.group_id === g.id));
  return { supabase, profile, rankings, ranking, periods, period, ...data, groups };
}
