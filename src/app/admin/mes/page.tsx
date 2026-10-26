import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPeriod, getRankings, loadRankingPeriod } from "@/lib/data";
import { computeStandings, hasBlockingTie } from "@/lib/standings";
import { periodLabel } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { StandingsTable } from "@/components/StandingsTable";
import { closeMonth, saveTiebreaks } from "../actions";

export default async function CloseMonthPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;
  const db = createAdminClient();
  const period = await getOpenPeriod(db);
  if (!period) return <p className="card text-sm">No hay mes abierto.</p>;

  const rankings = await getRankings(db);
  const data = await Promise.all(rankings.map((r) => loadRankingPeriod(db, r.id, period.id)));
  const unresolved = data.flatMap((d) => d.matches).filter((m) => ["pending", "reported", "disputed"].includes(m.status));
  let blockingTies = 0;

  const sections = rankings.map((r, ri) => {
    const { groups, entries, teams, matches } = data[ri];
    const used = groups.filter((g) => entries.some((e) => e.group_id === g.id));
    return (
      <section key={r.id} className="space-y-3">
        <h2 className="text-lg font-bold">{r.name}</h2>
        {used.length === 0 && <p className="text-sm text-muted">Sin grupos con equipos.</p>}
        {used.map((g, idx) => {
          const rows = computeStandings(
            teams,
            entries.filter((e) => e.group_id === g.id),
            matches.filter((m) => m.group_id === g.id),
          );
          const blocking = hasBlockingTie(rows);
          if (blocking) blockingTies++;
          const tied = rows.filter((x) => rows.some((y) => y !== x && y.points === x.points));
          return (
            <div key={g.id} className={`card ${blocking ? "ring-2 ring-amber-400/50" : ""}`}>
              <h3 className="h2 mb-2">{g.name}</h3>
              <StandingsTable rows={rows} canGoUp={idx > 0} canGoDown={idx < used.length - 1} showTies />
              {tied.length > 0 && (
                <form action={saveTiebreaks.bind(null, g.id)} className="mt-3 space-y-2 border-t border-line pt-3">
                  <p className="text-sm font-medium">
                    Desempate manual {blocking && <span className="text-amber-300">(obligatorio: decide quién sube/baja)</span>}
                  </p>
                  <p className="text-xs text-muted">Entre los empatados a puntos, pon 1 al que va por delante, 2 al siguiente...</p>
                  {tied.map((x) => (
                    <div key={x.team.id} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm">
                        {x.team.name} ({x.points} pts)
                      </span>
                      <input
                        name={`tb_${x.team.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        defaultValue={x.tiebreak ?? ""}
                        className="input w-20 py-1.5 text-center"
                      />
                    </div>
                  ))}
                  <button className="btn-secondary w-full">Guardar desempate</button>
                </form>
              )}
            </div>
          );
        })}
      </section>
    );
  });

  const canClose = unresolved.length === 0 && blockingTies === 0;

  return (
    <div className="space-y-4">
      <h1 className="h1">Cerrar {periodLabel(period)}</h1>
      <Flash {...flash} />

      {unresolved.length > 0 && (
        <div className="card ring-2 ring-down/40">
          <p className="text-sm">
            Quedan <strong>{unresolved.length}</strong> partido(s) sin cerrar (por jugar, por confirmar o en revisión).
            Entra en cada uno y pon el resultado, dalo como no presentado o anúlalo.
          </p>
          <Link href="/admin/partidos" className="mt-2 inline-block text-sm font-medium text-lime">
            Ir a partidos →
          </Link>
        </div>
      )}

      {sections}

      <form action={closeMonth} className="card space-y-2">
        <p className="text-sm text-muted">
          Al cerrar, el primero de cada grupo sube (▲) y el último baja (▼). Se abre el mes siguiente con los partidos ya
          generados. Esta acción no se puede deshacer.
        </p>
        <button className="btn w-full" disabled={!canClose}>
          Cerrar mes y abrir el siguiente
        </button>
      </form>
    </div>
  );
}
