import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOpenPeriod } from "@/lib/data";
import { LOGO_SRC } from "@/lib/brand";
import { signOut } from "@/app/login/actions";
import { NavTabs } from "@/components/NavTabs";
import { runAutoConfirm } from "@/lib/auto-confirm";
import { BellIcon, LogInIcon, LogOutIcon, ShieldIcon } from "@/components/Icons";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const archivo = Archivo({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Ranking Equipos VFV",
  description: "Clasificación, grupos y resultados de la liga de pádel por equipos VFV",
  appleWebApp: { capable: true, title: "Ranking VFV", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0f1a",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await runAutoConfirm().catch(() => {});
  const profile = await getProfile();
  const supabase = await createClient();

  // Notificaciones sin leer (RLS solo devuelve las del equipo, o las del admin)
  let unread = 0;
  if (profile) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    unread = count ?? 0;
  }

  // Resultados del rival pendientes de confirmar, para el aviso de la pestaña "Mi equipo"
  let pendingCount = 0;
  if (profile?.team_id) {
    const period = await getOpenPeriod(supabase);
    if (period) {
      const { count } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("period_id", period.id)
        .eq("status", "reported")
        .neq("reported_by_team_id", profile.team_id)
        .or(`home_team_id.eq.${profile.team_id},away_team_id.eq.${profile.team_id}`);
      pendingCount = count ?? 0;
    }
  }

  return (
    <html lang="es" className={`${inter.variable} ${archivo.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-3 pt-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-4 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_SRC} alt="Pádel X4" className="h-full w-full object-contain p-0.5" />
              </span>
              <span className="leading-none">
                <span className="block text-[11px] font-semibold tracking-[0.35em] text-muted">RANKING</span>
                <span className="font-display text-[22px] font-black tracking-tight">
                  EQUIPOS <span className="text-lime">VFV</span>
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-1">
              {profile && (
                <Link
                  href="/notificaciones"
                  className="relative grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-fg"
                  aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ""}`}
                >
                  <BellIcon className="h-6 w-6" />
                  {unread > 0 && (
                    <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-lime px-1 text-[11px] font-black text-ink">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              )}
              {profile?.role === "admin" && (
                <Link href="/admin" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-fg" aria-label="Administración">
                  <ShieldIcon />
                </Link>
              )}
              {profile ? (
                <form action={signOut}>
                  <button className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-fg" aria-label="Salir">
                    <LogOutIcon className="h-6 w-6" />
                  </button>
                </form>
              ) : (
                <Link href="/login" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-fg" aria-label="Entrar">
                  <LogInIcon className="h-6 w-6" />
                </Link>
              )}
            </div>
          </div>
          <NavTabs myTeamId={profile?.team_id ?? null} pendingCount={pendingCount} />
        </header>
        <main className="mx-auto max-w-3xl px-4 py-5 pb-16">{children}</main>
      </body>
    </html>
  );
}
