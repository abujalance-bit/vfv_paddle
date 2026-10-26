import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPeriod, getRankings } from "@/lib/data";
import { STATUS_LABEL, periodLabel, type Group, type Match, type MatchStatus, type Team } from "@/lib/types";
import { MatchRow } from "@/components/MatchRow";

const FILTERS: (MatchStatus | "todos")[] = ["todos", "pending", "reported", "disputed", "confirmed", "resolved"];

export default async function AdminMatchesPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado = "todos" } = await searchParams;
  const db = createAdminClient();
  const period = await getOpenPeriod(db);
  if (!period) return <p className="card text-sm">No hay mes abierto.</p>;

  const rankings = await getRankings(db);
  let query = db.from("matches").select("*").eq("period_id", period.id);
  if (estado !== "todos") query = query.eq("status", estado);
  const [{ data: matchesData }, { data: teamsData }, { data: groupsData }] = await Promise.all([
    query,
    db.from("teams").select("*"),
    db.from("groups").select("*").order("level"),
  ]);
  const matches = (matchesData ?? []) as Match[];
  const teams = (teamsData ?? []) as Team[];
  const groups = (groupsData ?? []) as Group[];

  return (
    <div className="space-y-4">
      <h1 className="h1">Partidos · {periodLabel(period)}</h1>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/partidos?estado=${f}`}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              f === estado ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-700 ring-gray-300"
            }`}
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </Link>
        ))}
      </div>

      {rankings.map((r) =>
        groups
          .filter((g) => g.ranking_id === r.id)
          .map((g) => {
            const list = matches.filter((m) => m.group_id === g.id);
            if (list.length === 0) return null;
            return (
              <section key={g.id} className="card">
                <h2 className="h2 mb-1">
                  {r.name} · {g.name}
                </h2>
                {list.map((m) => (
                  <MatchRow key={m.id} match={m} teams={teams} href={`/admin/partidos/${m.id}`} />
                ))}
              </section>
            );
          }),
      )}
      {matches.length === 0 && <p className="text-sm text-gray-500">No hay partidos con este filtro.</p>}
    </div>
  );
}
