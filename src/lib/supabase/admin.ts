import { createClient } from "@supabase/supabase-js";

// Cliente con la clave secreta: salta RLS. Solo se usa en el servidor tras requireAdmin()
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
