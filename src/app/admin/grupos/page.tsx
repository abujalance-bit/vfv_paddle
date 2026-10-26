import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPeriod, getRankings } from "@/lib/data";
import { periodLabel, type Group, type GroupEntry, type Team } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { createGroup, deleteGroup, moveGroup, renameGroup, setTeamGroup } from "../actions";

export default async function GroupsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;
  const db = createAdminClient();
  const period = await getOpenPeriod(db);
  const rankings = await getRankings(db);

  const [{ data: groupsData }, { data: teamsData }, entriesRes] = await Promise.all([
    db.from("groups").select("*").order("level"),
    db.from("teams").select("*").order("name"),
    period
      ? db.from("group_entries").select("*").eq("period_id", period.id)
      : Promise.resolve({ data: [] as GroupEntry[] }),
  ]);
  const groups = (groupsData ?? []) as Group[];
  const teams = (teamsData ?? []) as Team[];
  const entries = (entriesRes.data ?? []) as GroupEntry[];

  return (
    <div className="space-y-4">
      <h1 className="h1">Grupos</h1>
      <p className="text-sm text-muted">
        {period ? `Equipos en ${periodLabel(period)}` : "No hay mes abierto: puedes crear grupos, pero no asignar equipos."}
      </p>
      <Flash {...flash} />

      {rankings.map((r) => {
        const rGroups = groups.filter((g) => g.ranking_id === r.id);
        const unassigned = teams.filter((t) => t.ranking_id === r.id && t.active && !entries.some((e) => e.team_id === t.id));
        return (
          <section key={r.id} className="space-y-3">
            <h2 className="text-lg font-bold">{r.name}</h2>

            {rGroups.map((g, idx) => {
              const gTeams = entries
                .filter((e) => e.group_id === g.id)
                .map((e) => teams.find((t) => t.id === e.team_id))
                .filter((t): t is Team => !!t);
              return (
                <div key={g.id} className="card space-y-2">
                  <div className="flex items-center gap-2">
                    <form action={renameGroup.bind(null, g.id)} className="flex flex-1 gap-2">
                      <input name="name" defaultValue={g.name} className="input py-1.5 font-semibold" />
                      <button className="btn-secondary px-3 py-1.5">✓</button>
                    </form>
                    <form action={moveGroup.bind(null, g.id, -1)}>
                      <button className="btn-secondary px-3 py-1.5" disabled={idx === 0} aria-label="Subir">
                        ↑
                      </button>
                    </form>
                    <form action={moveGroup.bind(null, g.id, 1)}>
                      <button className="btn-secondary px-3 py-1.5" disabled={idx === rGroups.length - 1} aria-label="Bajar">
                        ↓
                      </button>
                    </form>
                  </div>
                  <ul className="text-sm">
                    {gTeams.map((t) => (
                      <li key={t.id} className="flex items-center justify-between border-t border-line py-1.5">
                        <span>{t.name}</span>
                        <form action={setTeamGroup.bind(null, t.id)}>
                          <input type="hidden" name="return_to" value="/admin/grupos" />
                          <input type="hidden" name="group_id" value="" />
                          <button className="text-xs text-down">quitar</button>
                        </form>
                      </li>
                    ))}
                    {gTeams.length === 0 && <li className="text-muted">Sin equipos</li>}
                  </ul>
                  <p className={`text-xs ${gTeams.length === 4 ? "text-muted" : "text-amber-300"}`}>
                    {gTeams.length} de 4 equipos
                  </p>
                  {gTeams.length === 0 && (
                    <form action={deleteGroup.bind(null, g.id)}>
                      <button className="text-xs text-down">Borrar grupo</button>
                    </form>
                  )}
                </div>
              );
            })}

            {period && unassigned.length > 0 && (
              <div className="card space-y-2 ring-2 ring-amber-400/50">
                <h3 className="font-semibold">Equipos sin grupo</h3>
                {unassigned.map((t) => (
                  <form key={t.id} action={setTeamGroup.bind(null, t.id)} className="flex items-center gap-2">
                    <input type="hidden" name="return_to" value="/admin/grupos" />
                    <span className="flex-1 truncate text-sm">{t.name}</span>
                    <select name="group_id" className="input w-36 py-1.5">
                      {rGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button className="btn px-3 py-1.5">Asignar</button>
                  </form>
                ))}
              </div>
            )}

            <form action={createGroup} className="flex gap-2">
              <input type="hidden" name="ranking_id" value={r.id} />
              <input name="name" className="input" placeholder={`Grupo ${rGroups.length + 1}`} defaultValue={`Grupo ${rGroups.length + 1}`} />
              <button className="btn whitespace-nowrap">+ Grupo</button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
