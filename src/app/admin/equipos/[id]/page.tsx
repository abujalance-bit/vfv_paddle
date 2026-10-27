import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPeriod } from "@/lib/data";
import { periodLabel, type Group, type Match, type Player, type Team } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { DeleteBox } from "@/components/DeleteBox";
import { deletePlayer, deleteTeam, resetPassword, setTeamGroup, updateTeam } from "../../actions";

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
  const [{ data: playersData }, { data: groupsData }, { data: profile }, { data: entry }, { data: matchesData }, { count: phases }] =
    await Promise.all([
      db.from("players").select("*").eq("team_id", id).order("position"),
      db.from("groups").select("*").eq("ranking_id", team.ranking_id).order("level"),
      db.from("profiles").select("username").eq("team_id", id).maybeSingle(),
      period
        ? db.from("group_entries").select("group_id").eq("period_id", period.id).eq("team_id", id).maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from("matches")
        .select("status, home_players, away_players")
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`),
      db.from("group_entries").select("period_id", { count: "exact", head: true }).eq("team_id", id),
    ]);
  const players = (playersData ?? []) as Player[];
  const groups = (groupsData ?? []) as Group[];
  const matches = (matchesData ?? []) as Pick<Match, "status" | "home_players" | "away_players">[];
  const played = matches.filter((m) => m.status !== "pending").length;
  const appearances = (pid: string) =>
    matches.filter((m) => m.home_players?.includes(pid) || m.away_players?.includes(pid)).length;

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
              {i === 0 && " · capitán/a"}
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

      <section className="card space-y-3">
        <h2 className="h2">Borrar</h2>
        {players.map((p) => (
          <DeleteBox
            key={p.id}
            compact
            title={`Borrar a ${p.name}`}
            action={deletePlayer.bind(null, team.id, p.id)}
            dependencies={[[appearances(p.id), "partido(s) en los que jugó (se quita de la alineación)"]]}
          />
        ))}
        <DeleteBox
          title="Borrar equipo"
          action={deleteTeam.bind(null, team.id)}
          dependencies={[
            [played, "partido(s) con resultado (también desaparecen de la clasificación del rival)"],
            [matches.length - played, "partido(s) por jugar"],
            [phases ?? 0, "fase(s) de historial en la clasificación"],
            [players.length, "jugador(es)"],
            [profile ? 1 : 0, `usuario de acceso (${profile?.username})`],
          ]}
          note="Si solo quieres que no pase a la fase siguiente, mejor desactívalo."
        />
      </section>
    </div>
  );
}
