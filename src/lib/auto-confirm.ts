import { createAdminClient } from "@/lib/supabase/admin";

// Da por buenos los resultados sin respuesta tras 2 días. pg_cron lo hace cada hora;
// esto lo repite al cargar páginas por si pg_cron no está activo en el proyecto.
let lastRun = 0;

export async function runAutoConfirm() {
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  await createAdminClient().rpc("auto_confirm_expired");
}
