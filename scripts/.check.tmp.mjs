import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
for (const t of ["teams", "players", "profiles", "periods", "group_entries", "matches", "notifications"]) {
  const live = await db.from(t).select("*", { count: "exact", head: true });
  const bak = await db.from("backup_20261027_" + t).select("*", { count: "exact", head: true });
  console.log(t.padEnd(14), "actual", live.count, "| copia", bak.error ? "ERR " + bak.error.message : bak.count);
}
console.log("fases:", JSON.stringify((await db.from("periods").select("id,start_date,end_date,status,visible").order("start_date")).data));
const a = await anon.from("teams").select("id").limit(1);
console.log("anon lee equipos:", a.error ? "bloqueado (" + a.error.code + ")" : `${a.data.length} filas`);
const b = await anon.from("backup_20261027_teams").select("id").limit(1);
console.log("anon lee copia:", b.error ? "bloqueado" : `${b.data.length} filas`);
const c = await db.rpc("close_period", {
  p_period: "00000000-0000-0000-0000-000000000000",
  p_results: [],
  p_next: "00000000-0000-0000-0000-000000000000",
});
console.log("close_period nueva firma:", c.error?.message);
