// Reseteo único tras las pruebas: reabre la fase 19 oct–14 nov con los grupos originales y todos los
// partidos vacíos, borra la fase 15 nov–11 dic y las notificaciones. No toca equipos, jugadores ni usuarios.
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const ck = (r, label) => {
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r;
};
const count = async (t) => (await db.from(t).select("*", { count: "exact", head: true })).count;

const before = { teams: await count("teams"), players: await count("players"), profiles: await count("profiles") };
console.log("antes:", before);

// La copia en Supabase tiene que existir antes de borrar nada
const bak = await db.from("backup_20261027_matches").select("*", { count: "exact", head: true });
if (bak.error || !bak.count) throw new Error("No encuentro la copia backup_20261027_matches: no sigo");

const { data: periods } = ck(await db.from("periods").select("*").order("start_date"), "fases");
const first = periods.find((p) => p.start_date === "2026-10-19");
const second = periods.find((p) => p.start_date === "2026-11-15");
if (!first) throw new Error("No encuentro la fase del 19 oct: no sigo");
const others = periods.filter((p) => p.id !== first.id && p.id !== second?.id);
if (others.length) throw new Error("Hay fases que no esperaba: " + others.map((p) => p.start_date).join(", "));

if (second) {
  ck(await db.from("periods").delete().eq("id", second.id), "borrar fase 2");
  console.log("borrada fase", second.start_date, "–", second.end_date);
}
ck(await db.from("periods").update({ status: "open", closed_at: null }).eq("id", first.id), "reabrir fase 1");
ck(
  await db.from("group_entries").update({ tiebreak: null, final_position: null, movement: null }).eq("period_id", first.id),
  "limpiar posiciones",
);
ck(
  await db
    .from("matches")
    .update({
      status: "pending",
      result_type: "normal",
      sets: null,
      winner_team_id: null,
      home_players: null,
      away_players: null,
      played_on: null,
      reported_by_team_id: null,
      reported_at: null,
      confirmed_at: null,
      dispute_reason: null,
    })
    .eq("period_id", first.id),
  "vaciar partidos",
);
ck(await db.from("notifications").delete().not("id", "is", null), "borrar notificaciones");

const after = { teams: await count("teams"), players: await count("players"), profiles: await count("profiles") };
console.log("después:", after);
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("¡Han cambiado equipos/jugadores/usuarios!");

const { data: ms } = await db.from("matches").select("status");
console.log("partidos:", ms.length, ms.reduce((a, m) => ((a[m.status] = (a[m.status] ?? 0) + 1), a), {}));
console.log("entradas de grupo:", await count("group_entries"), "| notificaciones:", await count("notifications"));
console.log("fases:", JSON.stringify((await db.from("periods").select("start_date,end_date,status,visible")).data));
