import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getOpenPeriod } from "@/lib/data";
import { periodLabel, type Announcement, type Match, type Team } from "@/lib/types";
import { MatchRow } from "@/components/MatchRow";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const period = await getOpenPeriod(supabase);

  const { data: annData } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);
  const announcements = (annData ?? []) as Announcement[];

  let myTeam: Team | null = null;
  let myMatches: Match[] = [];
  let teams: Team[] = [];
  if (profile?.team_id && period) {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase
        .from("matches")
        .select("*")
        .eq("period_id", period.id)
        .or(`home_team_id.eq.${profile.team_id},away_team_id.eq.${profile.team_id}`),
    ]);
    teams = (t ?? []) as Team[];
    myTeam = teams.find((x) => x.id === profile.team_id) ?? null;
    myMatches = (m ?? []) as Match[];
  }

  const toConfirm = myMatches.filter((m) => m.status === "reported" && m.reported_by_team_id !== profile?.team_id);
  const waiting = myMatches.filter((m) => m.status === "reported" && m.reported_by_team_id === profile?.team_id);

  let disputedCount = 0;
  if (profile?.role === "admin" && period) {
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("period_id", period.id)
      .eq("status", "disputed");
    disputedCount = count ?? 0;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">{myTeam ? myTeam.name : "Liga VFV Pádel"}</h1>
        <p className="text-sm text-gray-500">{period ? `Mes en juego: ${periodLabel(period)}` : "No hay mes abierto"}</p>
      </div>

      {toConfirm.length > 0 && (
        <section className="card ring-2 ring-amber-300">
          <h2 className="h2 mb-1">🔔 Tienes {toConfirm.length} resultado(s) por confirmar</h2>
          <p className="mb-1 text-sm text-gray-600">El equipo rival ha subido el resultado. Revísalo y confírmalo.</p>
          {toConfirm.map((m) => (
            <MatchRow key={m.id} match={m} teams={teams} />
          ))}
        </section>
      )}

      {profile?.role === "admin" && (
        <Link href="/admin" className="card block">
          <h2 className="h2">Panel de administración →</h2>
          {disputedCount > 0 && (
            <p className="mt-1 text-sm font-medium text-red-700">⚠️ {disputedCount} partido(s) en revisión</p>
          )}
        </Link>
      )}

      {myTeam && (
        <section className="card">
          <h2 className="h2 mb-1">Mis partidos del mes</h2>
          {myMatches.length === 0 && <p className="text-sm text-gray-500">Aún no tienes partidos asignados.</p>}
          {myMatches.map((m) => (
            <MatchRow key={m.id} match={m} teams={teams} />
          ))}
          {waiting.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              {waiting.length} resultado(s) subidos por ti esperando confirmación del rival.
            </p>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/ranking/masculino" className="card text-center font-semibold">
          Ranking masculino
        </Link>
        <Link href="/ranking/femenino" className="card text-center font-semibold">
          Ranking femenino
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="h2">Avisos</h2>
        {announcements.length === 0 && <p className="text-sm text-gray-500">No hay avisos.</p>}
        {announcements.map((a) => (
          <article key={a.id} className="card">
            <h3 className="font-semibold">
              {a.pinned && "📌 "}
              {a.title}
            </h3>
            <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString("es-ES")}</p>
            {a.body && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{a.body}</p>}
          </article>
        ))}
      </section>

      {!profile && (
        <p className="text-center text-sm text-gray-500">
          ¿Eres de un equipo?{" "}
          <Link href="/login" className="font-medium text-brand-700">
            Entra
          </Link>{" "}
          para subir resultados.
        </p>
      )}
    </div>
  );
}
