import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { BellIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

type Notification = {
  id: string;
  match_id: string | null;
  kind: "reported" | "confirmed" | "auto_confirmed" | "disputed" | "resolved";
  message: string;
  read_at: string | null;
  created_at: string;
  for_admin: boolean;
};

const KIND: Record<Notification["kind"], { label: string; style: string }> = {
  reported: { label: "Por confirmar", style: "bg-amber-400/15 text-amber-300" },
  confirmed: { label: "Confirmado", style: "bg-up/15 text-up" },
  auto_confirmed: { label: "Confirmado (5 días)", style: "bg-up/15 text-up" },
  disputed: { label: "Rechazado", style: "bg-down/15 text-down" },
  resolved: { label: "Resuelto por admin", style: "bg-sky-400/15 text-sky-300" },
};

export default async function NotificationsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("id, match_id, kind, message, read_at, created_at, for_admin")
    .order("created_at", { ascending: false })
    .limit(50);
  const notifications = (data ?? []) as Notification[];

  // Al abrir la página se marcan como leídas (se resaltan las nuevas en esta visita)
  if (notifications.some((n) => !n.read_at)) await supabase.rpc("mark_notifications_read");

  return (
    <div className="space-y-4">
      <h1 className="h1 text-3xl">Notificaciones</h1>
      {notifications.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-10 text-center text-muted">
          <BellIcon className="h-8 w-8" />
          <p className="text-sm">No tienes notificaciones.</p>
        </div>
      )}
      <ul className="space-y-2">
        {notifications.map((n) => {
          const href = n.match_id ? (profile.role === "admin" && n.for_admin ? `/admin/partidos/${n.match_id}` : `/partido/${n.match_id}`) : null;
          const body = (
            <div className={`rounded-3xl border p-4 ${n.read_at ? "border-line bg-panel" : "border-lime/40 bg-lime/5"}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${KIND[n.kind].style}`}>{KIND[n.kind].label}</span>
                <span className="text-xs text-muted">
                  {new Date(n.created_at).toLocaleString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Madrid",
                  })}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{n.message}</p>
            </div>
          );
          return <li key={n.id}>{href ? <Link href={href}>{body}</Link> : body}</li>;
        })}
      </ul>
    </div>
  );
}
