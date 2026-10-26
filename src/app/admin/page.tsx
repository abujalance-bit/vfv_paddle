import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPeriod } from "@/lib/data";
import { addDays, periodLabel, type Match, type Team } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { PeriodDates } from "@/components/PeriodDates";
import { MatchRow } from "@/components/MatchRow";
import { startPeriod } from "./actions";

export default async function AdminHome({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;
  const db = createAdminClient();
  const period = await getOpenPeriod(db);

  if (!period) {
    const today = new Date().toISOString().slice(0, 10);
    return (
      <div className="space-y-4">
        <h1 className="h1">Panel de administración</h1>
        <Flash {...flash} />
        <form action={startPeriod} className="card space-y-3">
          <h2 className="h2">Iniciar fase</h2>
          <p className="text-sm text-muted">
            No hay ninguna fase abierta. Inicia una y después asigna los equipos a sus grupos (los partidos se generan
            solos).
          </p>
          <PeriodDates start={today} end={addDays(today, 26)} />
          <button className="btn w-full">Iniciar fase</button>
        </form>
      </div>
    );
  }

  const [{ data: matchesData }, { data: teamsData }] = await Promise.all([
    db.from("matches").select("*").eq("period_id", period.id),
    db.from("teams").select("*"),
  ]);
  const matches = (matchesData ?? []) as Match[];
  const teams = (teamsData ?? []) as Team[];
  const count = (s: Match["status"]) => matches.filter((m) => m.status === s).length;
  const disputed = matches.filter((m) => m.status === "disputed");

  return (
    <div className="space-y-4">
      <h1 className="h1">Panel · {periodLabel(period)}</h1>
      <Flash {...flash} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Por jugar" value={count("pending")} />
        <Stat label="Por confirmar" value={count("reported")} />
        <Stat label="En revisión" value={count("disputed")} alert />
        <Stat label="Cerrados" value={count("confirmed") + count("resolved")} />
      </div>

      {disputed.length > 0 && (
        <section className="card space-y-2 ring-2 ring-down/40">
          <h2 className="h2 mb-1">⚠️ Resultados rechazados</h2>
          <p className="mb-1 text-sm text-muted">El rival no está de acuerdo. Entra y pon el resultado correcto.</p>
          {disputed.map((m) => (
            <MatchRow key={m.id} match={m} teams={teams} href={`/admin/partidos/${m.id}`} />
          ))}
        </section>
      )}

      <section className="card space-y-2 text-sm text-fg/85">
        <h2 className="h2">Cómo funciona</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Crea los <Link className="text-lime underline" href="/admin/grupos">grupos</Link> de cada ranking
            (Grupo 1 es el más alto).
          </li>
          <li>
            Crea los <Link className="text-lime underline" href="/admin/equipos">equipos</Link> con sus 3
            jugadores, usuario y contraseña, y asígnalos a un grupo.
          </li>
          <li>
            Los equipos suben sus resultados y el rival los confirma. Si no responde en 5 días, se dan por buenos.
          </li>
          <li>
            Al acabar la fase, resuelve los pendientes y{" "}
            <Link className="text-lime underline" href="/admin/mes">cierra la fase</Link>.
          </li>
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`card text-center ${alert && value > 0 ? "ring-2 ring-down/40" : ""}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
