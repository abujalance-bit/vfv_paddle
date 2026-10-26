import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPeriod } from "@/lib/data";
import { periodLabel, type Match, type Team } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { MatchRow } from "@/components/MatchRow";
import { startPeriod } from "./actions";

export default async function AdminHome({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;
  const db = createAdminClient();
  const period = await getOpenPeriod(db);

  if (!period) {
    const now = new Date();
    return (
      <div className="space-y-4">
        <h1 className="h1">Panel de administración</h1>
        <Flash {...flash} />
        <form action={startPeriod} className="card space-y-3">
          <h2 className="h2">Iniciar mes</h2>
          <p className="text-sm text-gray-600">
            No hay ningún mes abierto. Inicia uno y después asigna los equipos a sus grupos (los partidos se generan
            solos).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mes</label>
              <select name="month" className="input" defaultValue={now.getMonth() + 1}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {periodLabel({ year: 2000, month: i + 1 }).split(" ")[0]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Año</label>
              <input name="year" type="number" className="input" defaultValue={now.getFullYear()} />
            </div>
          </div>
          <button className="btn w-full">Iniciar mes</button>
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
        <section className="card ring-2 ring-red-200">
          <h2 className="h2 mb-1">⚠️ Resultados rechazados</h2>
          <p className="mb-1 text-sm text-gray-600">El rival no está de acuerdo. Entra y pon el resultado correcto.</p>
          {disputed.map((m) => (
            <MatchRow key={m.id} match={m} teams={teams} href={`/admin/partidos/${m.id}`} />
          ))}
        </section>
      )}

      <section className="card space-y-2 text-sm text-gray-700">
        <h2 className="h2">Cómo funciona</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Crea los <Link className="text-brand-700 underline" href="/admin/grupos">grupos</Link> de cada ranking
            (Grupo 1 es el más alto).
          </li>
          <li>
            Crea los <Link className="text-brand-700 underline" href="/admin/equipos">equipos</Link> con sus 3
            jugadores, usuario y contraseña, y asígnalos a un grupo.
          </li>
          <li>Los equipos suben sus resultados y el rival los confirma.</li>
          <li>
            A final de mes, resuelve los pendientes y{" "}
            <Link className="text-brand-700 underline" href="/admin/mes">cierra el mes</Link>.
          </li>
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`card text-center ${alert && value > 0 ? "ring-2 ring-red-300" : ""}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
