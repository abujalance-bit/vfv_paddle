import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { formatResult } from "@/lib/sets";
import { periodLabel, type Group, type Match, type Period, type Player, type Team } from "@/lib/types";
import { StatusBadge } from "@/components/MatchRow";
import { Flash, type FlashParams } from "@/components/Flash";
import { PlayerPicker, SetsInputs } from "@/components/ResultFields";
import { confirmResult, disputeResult, reportResult, withdrawResult } from "./actions";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle<Match>();
  if (!match) notFound();

  const [{ data: teamsData }, { data: playersData }, { data: period }, { data: group }] = await Promise.all([
    supabase.from("teams").select("*").in("id", [match.home_team_id, match.away_team_id]),
    supabase.from("players").select("*").in("team_id", [match.home_team_id, match.away_team_id]).order("position"),
    supabase.from("periods").select("*").eq("id", match.period_id).single<Period>(),
    supabase.from("groups").select("*").eq("id", match.group_id).single<Group>(),
  ]);
  const teams = (teamsData ?? []) as Team[];
  const players = (playersData ?? []) as Player[];
  const home = teams.find((t) => t.id === match.home_team_id)!;
  const away = teams.find((t) => t.id === match.away_team_id)!;
  const homePlayers = players.filter((p) => p.team_id === home.id);
  const awayPlayers = players.filter((p) => p.team_id === away.id);
  const playerName = (pid: string) => players.find((p) => p.id === pid)?.name ?? "¿?";

  const myTeam = profile?.team_id;
  const isMine = !!myTeam && (myTeam === home.id || myTeam === away.id);
  const isOpen = period?.status === "open";
  const reportedByMe = match.reported_by_team_id === myTeam;

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-brand-700">
        ← Volver
      </Link>
      <Flash {...flash} />

      <section className="card">
        <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            {group?.name} · {period && periodLabel(period)}
          </span>
          <StatusBadge status={match.status} />
        </div>
        <div className="space-y-1 text-lg">
          <div className={match.winner_team_id === home.id ? "font-bold" : ""}>{home.name}</div>
          <div className="text-xs text-gray-400">vs</div>
          <div className={match.winner_team_id === away.id ? "font-bold" : ""}>{away.name}</div>
        </div>
        {match.status !== "pending" && (
          <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
            <p className="font-mono text-base">{formatResult(match)}</p>
            {match.played_on && (
              <p className="text-gray-500">Jugado el {new Date(match.played_on).toLocaleDateString("es-ES")}</p>
            )}
            {match.home_players && (
              <p className="text-gray-600">
                {home.name}: {match.home_players.map(playerName).join(" y ")}
              </p>
            )}
            {match.away_players && (
              <p className="text-gray-600">
                {away.name}: {match.away_players.map(playerName).join(" y ")}
              </p>
            )}
            {match.status === "disputed" && match.dispute_reason && (
              <p className="text-red-700">Motivo del rechazo: {match.dispute_reason}</p>
            )}
          </div>
        )}
      </section>

      {isMine && isOpen && match.status === "pending" && (
        <form action={reportResult.bind(null, match.id)} className="card space-y-4">
          <h2 className="h2">Subir resultado</h2>
          <SetsInputs home={home} away={away} />
          <PlayerPicker team={home} players={homePlayers} name="home_players" />
          <PlayerPicker team={away} players={awayPlayers} name="away_players" />
          <div>
            <label className="label" htmlFor="played_on">Fecha del partido</label>
            <input
              id="played_on"
              name="played_on"
              type="date"
              className="input"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <button className="btn w-full">Enviar resultado</button>
          <p className="text-xs text-gray-500">El equipo rival recibirá un aviso para confirmarlo.</p>
        </form>
      )}

      {isMine && isOpen && match.status === "reported" && !reportedByMe && (
        <section className="card space-y-3 ring-2 ring-amber-300">
          <h2 className="h2">¿Es correcto este resultado?</h2>
          <form action={confirmResult.bind(null, match.id)}>
            <button className="btn w-full">✓ Sí, confirmar</button>
          </form>
          <form action={disputeResult.bind(null, match.id)} className="space-y-2">
            <textarea name="reason" className="input" rows={2} placeholder="Si no es correcto, explica por qué" />
            <button className="btn-danger w-full">✗ No es correcto</button>
          </form>
        </section>
      )}

      {isMine && isOpen && match.status === "reported" && reportedByMe && (
        <section className="card space-y-3">
          <p className="text-sm text-gray-600">Esperando a que el equipo rival confirme el resultado.</p>
          <form action={withdrawResult.bind(null, match.id)}>
            <button className="btn-secondary w-full">Retirar resultado para corregirlo</button>
          </form>
        </section>
      )}

      {match.status === "disputed" && isMine && (
        <p className="card text-sm text-gray-600">El administrador revisará este partido y pondrá el resultado.</p>
      )}

      {profile?.role === "admin" && (
        <Link href={`/admin/partidos/${match.id}`} className="btn-secondary w-full">
          Editar como administrador
        </Link>
      )}
    </div>
  );
}
