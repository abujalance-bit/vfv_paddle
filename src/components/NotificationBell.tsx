"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BellIcon } from "@/components/Icons";

const REFRESH_MS = 60_000;

// La cabecera no se vuelve a pintar al navegar, así que el contador se mantiene al día desde el navegador:
// al abrir Notificaciones se marcan como leídas, y en cada cambio de página y cada minuto se vuelve a contar.
export function NotificationBell({ initialCount }: { initialCount: number }) {
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const onPage = pathname === "/notificaciones";

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function refresh() {
      if (onPage) await supabase.rpc("mark_notifications_read");
      const { count: unread } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (!cancelled) setCount(unread ?? 0);
    }

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onPage, pathname]);

  const shown = onPage ? 0 : count;

  return (
    <Link
      href="/notificaciones"
      className="relative grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-fg"
      aria-label={`Notificaciones${shown ? ` (${shown} sin leer)` : ""}`}
    >
      <BellIcon className="h-6 w-6" />
      {shown > 0 && (
        <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-lime px-1 text-[11px] font-black text-ink">
          {shown > 9 ? "9+" : shown}
        </span>
      )}
    </Link>
  );
}
