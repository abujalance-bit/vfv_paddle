import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPeriod, getRankings } from "@/lib/data";
import type { Group, GroupEntry, Player, Team } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { createTeam } from "../actions";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;
  const db = createAdminClient();
  const period = await getOpenPeriod(db);
  const rankings = await getRankings(db);

  const [{ data: teamsData }, { data: groupsData }, { data: playersData }, { data: profilesData }, entriesRes] =
    await Promise.all([
      db.from("teams").select("*").order("name"),
      db.from("groups").select("*").order("ranking_id").order("level"),
      db.from("players").select("*").order("position"),
      db.from("profiles").select("username, team_id"),
      period
        ? db.from("group_entries").select("*").eq("period_id", period.id)
        : Promise.resolve({ data: [] as GroupEntry[] }),
    ]);
  const teams = (teamsData ?? []) as Team[];
  const groups = (groupsData ?? []) as Group[];
  const players = (playersData ?? []) as Player[];
  const profiles = (profilesData ?? []) as { username: string; team_id: string | null }[];
  const entries = (entriesRes.data ?? []) as GroupEntry[];

  return (
    <div className="space-y-4">
      <h1 className="h1">Equipos</h1>
      <Flash {...flash} />

      <details className="card" open={teams.length === 0}>
        <summary className="h2 cursor-pointer">+ Nuevo equipo</summary>
        <form action={createTeam} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ranking</label>
              <select name="ranking_id" className="input">
                {rankings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Grupo {!period && "(inicia un mes)"}</label>
              <select name="group_id" className="input" disabled={!period}>
                <option value="">Sin grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {rankings.find((r) => r.id === g.ranking_id)?.name} · {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nombre del equipo</label>
            <input name="name" className="input" required />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <label className="label">Jugador/a {i}</label>
              <input name={`player${i}`} className="input" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Usuario</label>
              <input name="username" className="input" autoCapitalize="none" placeholder="los-tigres" required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input name="password" className="input" minLength={6} required />
            </div>
          </div>
          <button className="btn w-full">Crear equipo</button>
        </form>
      </details>

      {rankings.map((r) => {
        const list = teams.filter((t) => t.ranking_id === r.id);
        return (
          <section key={r.id} className="card">
            <h2 className="h2 mb-1">
              {r.name} ({list.length})
            </h2>
            {list.length === 0 && <p className="text-sm text-gray-500">Sin equipos.</p>}
            {list.map((t) => {
              const entry = entries.find((e) => e.team_id === t.id);
              const group = groups.find((g) => g.id === entry?.group_id);
              return (
                <Link
                  key={t.id}
                  href={`/admin/equipos/${t.id}`}
                  className="flex items-center justify-between gap-2 border-t border-gray-100 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {t.name} {!t.active && <span className="text-xs text-red-600">(inactivo)</span>}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {players
                        .filter((p) => p.team_id === t.id)
                        .map((p) => p.name)
                        .join(", ")}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>{group?.name ?? "Sin grupo"}</div>
                    <div>@{profiles.find((p) => p.team_id === t.id)?.username ?? "—"}</div>
                  </div>
                </Link>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
