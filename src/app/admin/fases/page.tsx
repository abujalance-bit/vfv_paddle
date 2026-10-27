import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, PERIOD_STATUS_LABEL, periodLabel, type Period } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { PeriodDates } from "@/components/PeriodDates";
import { PhaseCountdown } from "@/components/PhaseCountdown";
import { DeleteBox } from "@/components/DeleteBox";
import { createPeriod, deletePeriod, openPeriod, updatePeriod } from "../actions";

const STATUS_STYLE: Record<Period["status"], string> = {
  planned: "bg-sky-400/15 text-sky-300",
  open: "bg-lime text-ink",
  closed: "bg-white/10 text-muted",
};

export default async function PeriodsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;
  const db = createAdminClient();
  const { data } = await db.from("periods").select("*").order("start_date", { ascending: false });
  const periods = (data ?? []) as Period[];
  const hasOpen = periods.some((p) => p.status === "open");
  const latest = periods[0];
  const nextStart = latest ? addDays(latest.end_date, 1) : new Date().toISOString().slice(0, 10);

  // Partidos por fase, para avisar de lo que se pierde al borrar
  const [{ data: matchRows }, { data: entryRows }] = await Promise.all([
    db.from("matches").select("period_id, status"),
    db.from("group_entries").select("period_id"),
  ]);
  const matchCount = (id: string, played: boolean) =>
    (matchRows ?? []).filter((m) => m.period_id === id && (m.status !== "pending") === played).length;
  const entryCount = (id: string) => (entryRows ?? []).filter((e) => e.period_id === id).length;

  return (
    <div className="space-y-4">
      <h1 className="h1">Fases</h1>
      <Flash {...flash} />

      <details className="card" open={periods.length === 0}>
        <summary className="h2 cursor-pointer">+ Nueva fase</summary>
        <form action={createPeriod} className="mt-3 space-y-3">
          <PeriodDates start={nextStart} end={addDays(nextStart, 26)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="visible" defaultChecked className="h-4 w-4 accent-lime" />
            Visible para los equipos
          </label>
          {!hasOpen && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="open_now" className="h-4 w-4 accent-lime" />
              Abrirla ya (si no, queda programada)
            </label>
          )}
          <button className="btn w-full">Crear fase</button>
          <p className="text-xs text-muted">
            Las fases programadas se abren al cerrar la fase en juego desde{" "}
            <Link href="/admin/mes" className="text-lime underline">
              Cerrar fase
            </Link>
            .
          </p>
        </form>
      </details>

      {periods.map((p) => (
        <section key={p.id} className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-black uppercase">{periodLabel(p)}</h2>
            <div className="flex items-center gap-2">
              {!p.visible && <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">Oculta</span>}
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[p.status]}`}>
                {PERIOD_STATUS_LABEL[p.status]}
              </span>
            </div>
          </div>
          {p.status === "open" && <PhaseCountdown period={p} />}

          <form action={updatePeriod.bind(null, p.id)} className="space-y-3">
            <PeriodDates start={p.start_date} end={p.end_date} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="visible" defaultChecked={p.visible} className="h-4 w-4 accent-lime" />
              Visible para los equipos
            </label>
            <button className="btn-secondary w-full">Guardar cambios</button>
          </form>

          {p.status === "planned" && !hasOpen && (
            <form action={openPeriod.bind(null, p.id)}>
              <button className="btn w-full">Abrir esta fase</button>
            </form>
          )}

          <DeleteBox
            title="Borrar fase"
            action={deletePeriod.bind(null, p.id)}
            dependencies={[
              [entryCount(p.id), "equipo(s) asignados a grupos en esta fase"],
              [matchCount(p.id, true), "partido(s) con resultado"],
              [matchCount(p.id, false), "partido(s) por jugar"],
            ]}
            note="Los equipos, los grupos y los usuarios no se tocan."
          />
        </section>
      ))}
    </div>
  );
}
