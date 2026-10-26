import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatResult } from "@/lib/sets";
import type { Match, Player, Team } from "@/lib/types";
import { StatusBadge } from "@/components/MatchRow";
import { Flash, type FlashParams } from "@/components/Flash";
import { PlayerPicker, SetsInputs } from "@/components/ResultFields";
import { setResult } from "../../actions";

export default async function AdminMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const db = createAdminClient();

  const { data: match } = await db.from("matches").select("*").eq("id", id).maybeSingle<Match>();
  if (!match) notFound();
  const [{ data: teamsData }, { data: playersData }] = await Promise.all([
    db.from("teams").select("*").in("id", [match.home_team_id, match.away_team_id]),
    db.from("players").select("*").in("team_id", [match.home_team_id, match.away_team_id]).order("position"),
  ]);
  const teams = (teamsData ?? []) as Team[];
  const players = (playersData ?? []) as Player[];
  const home = teams.find((t) => t.id === match.home_team_id)!;
  const away = teams.find((t) => t.id === match.away_team_id)!;

  return (
    <div className="space-y-4">
      <Link href="/admin/partidos" className="text-sm text-brand-700">
        ← Partidos
      </Link>
      <Flash {...flash} />

      <section className="card space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="h2">
            {home.name} vs {away.name}
          </h1>
          <StatusBadge status={match.status} />
        </div>
        {match.status !== "pending" && <p className="font-mono text-sm">{formatResult(match)}</p>}
        {match.dispute_reason && <p className="text-sm text-red-700">Motivo del rechazo: {match.dispute_reason}</p>}
        {match.reported_by_team_id && (
          <p className="text-xs text-gray-500">
            Subido por {teams.find((t) => t.id === match.reported_by_team_id)?.name}
          </p>
        )}
      </section>

      <form action={setResult.bind(null, match.id)} className="card space-y-4">
        <h2 className="h2">Poner resultado</h2>
        <fieldset className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["normal", "Resultado normal"],
            ["walkover", "No presentado"],
            ["void", "Anular (0 y 0)"],
            ["pending", "Dejar pendiente"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-gray-300 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-500"
            >
              <input
                type="radio"
                name="type"
                value={value}
                defaultChecked={value === (match.status === "pending" ? "normal" : match.result_type)}
                className="accent-brand-600"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="space-y-4 rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Si es resultado normal</p>
          <SetsInputs home={home} away={away} initial={match.sets} />
          <PlayerPicker
            team={home}
            players={players.filter((p) => p.team_id === home.id)}
            name="home_players"
            selected={match.home_players}
          />
          <PlayerPicker
            team={away}
            players={players.filter((p) => p.team_id === away.id)}
            name="away_players"
            selected={match.away_players}
          />
        </div>

        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Si es no presentado: ¿quién gana?</p>
          <select name="winner" className="input" defaultValue={match.winner_team_id ?? ""}>
            <option value="">—</option>
            <option value={home.id}>{home.name}</option>
            <option value={away.id}>{away.name}</option>
          </select>
          <p className="text-xs text-gray-500">El ganador suma 3 puntos y el no presentado 0.</p>
        </div>

        <div>
          <label className="label">Fecha</label>
          <input name="played_on" type="date" className="input" defaultValue={match.played_on ?? ""} />
        </div>
        <button className="btn w-full">Guardar</button>
      </form>
    </div>
  );
}
