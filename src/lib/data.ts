import type { SupabaseClient } from "@supabase/supabase-js";
import type { Group, GroupEntry, Match, Period, Ranking, Team } from "@/lib/types";

export async function getOpenPeriod(supabase: SupabaseClient) {
  const { data } = await supabase.from("periods").select("*").eq("status", "open").maybeSingle();
  return (data as Period | null) ?? null;
}

export async function getRankings(supabase: SupabaseClient) {
  const { data } = await supabase.from("rankings").select("*").order("id");
  return (data ?? []) as Ranking[];
}

export type RankingPeriodData = {
  groups: Group[];
  entries: GroupEntry[];
  teams: Team[];
  matches: Match[];
};

// Todo lo necesario para pintar la clasificación de un ranking en un mes
export async function loadRankingPeriod(
  supabase: SupabaseClient,
  rankingId: number,
  periodId: string,
): Promise<RankingPeriodData> {
  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .eq("ranking_id", rankingId)
    .order("level");
  const groupIds = (groups ?? []).map((g) => g.id);
  if (groupIds.length === 0) return { groups: [], entries: [], teams: [], matches: [] };

  const [entries, teams, matches] = await Promise.all([
    supabase.from("group_entries").select("*").eq("period_id", periodId).in("group_id", groupIds),
    supabase.from("teams").select("*").eq("ranking_id", rankingId),
    supabase.from("matches").select("*").eq("period_id", periodId).in("group_id", groupIds),
  ]);

  return {
    groups: (groups ?? []) as Group[],
    entries: (entries.data ?? []) as GroupEntry[],
    teams: (teams.data ?? []) as Team[],
    matches: (matches.data ?? []) as Match[],
  };
}
