import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPeriod } from "@/lib/data";
import { periodLabel, type Group, type Player, type Team } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { resetPassword, setTeamGroup, updateTeam } from "../../actions";

export default async function TeamEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const db = createAdminClient();

  const { data: team } = await db.from("teams").select("*").eq("id", id).maybeSingle<Team>();
  if (!team) notFound();

  const period = await getOpenPeriod(db);
  const [{ data: playersData }, { data: groupsData }, { data: profile }, { data: entry }] = await Promise.all([
    db.from("players").select("*").eq("team_id", id).order("position"),
    db.from("groups").select("*").eq("ranking_id", team.ranking_id).order("level"),
    db.from("profiles").select("username").eq("team_id", id).maybeSingle(),
    period
      ? db.from("group_entries").select("group_id").eq("period_id", period.id).eq("team_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const players = (playersData ?? []) as Player[];
  const groups = (groupsData ?? []) as Group[];

  return (
    <div className="space-y-4">
      <Link href="/admin/equipos" className="text-sm text-lime">
        ← Equipos
      </Link>
      <h1 className="h1">{team.name}</h1>
      <Flash {...flash} />

      <form action={updateTeam.bind(null, team.id)} className="card space-y-3">
        <h2 className="h2">Datos del equipo</h2>
        <div>
          <label className="label">Nombre</label>
          <input name="name" className="input" defaultValue={team.name} required />
        </div>
        {players.map((p, i) => (
          <div key={p.id}>
            <label className="label">
              Jugador/a {i + 1}
              {i === 0 && " · capitán/a"} (vacío = quitar)
            </label>
            <input name={`player_${p.id}`} className="input" defaultValue={p.name} />
          </div>
        ))}
        <div>
          <label className="label">Añadir jugador/a</label>
          <input name="new_player" className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={team.active} className="h-4 w-4 accent-lime" />
          Activo (si lo desactivas, no pasa a la fase siguiente)
        </label>
        <button className="btn w-full">Guardar</button>
      </form>

      <form action={setTeamGroup.bind(null, team.id)} className="card space-y-3">
        <h2 className="h2">Grupo {period ? `en ${periodLabel(period)}` : ""}</h2>
        {period ? (
          <>
            <select name="group_id" className="input" defaultValue={entry?.group_id ?? ""}>
              <option value="">Sin grupo</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              Al cambiar de grupo se borran sus partidos del grupo anterior y se crean los del nuevo.
            </p>
            <button className="btn-secondary w-full">Cambiar grupo</button>
          </>
        ) : (
          <p className="text-sm text-muted">No hay fase abierta.</p>
        )}
      </form>

      <form action={resetPassword.bind(null, team.id)} className="card space-y-3">
        <h2 className="h2">Acceso</h2>
        <p className="text-sm text-muted">
          Usuario: <span className="font-mono font-semibold">{profile?.username ?? "sin usuario"}</span>
        </p>
        <input name="password" className="input" placeholder="Nueva contraseña" minLength={6} required />
        <button className="btn-secondary w-full">Cambiar contraseña</button>
      </form>
    </div>
  );
}
