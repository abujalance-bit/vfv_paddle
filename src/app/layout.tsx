import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "VFV Pádel",
  description: "Rankings, grupos y resultados de la liga de pádel",
  appleWebApp: { capable: true, title: "VFV Pádel", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile();

  return (
    <html lang="es">
      <body className="min-h-dvh font-sans antialiased">
        <header className="sticky top-0 z-10 bg-brand-700 text-white shadow">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              🎾 VFV Pádel
            </Link>
            {profile ? (
              <form action={signOut} className="flex items-center gap-3 text-sm">
                <span className="max-w-32 truncate opacity-90">{profile.username}</span>
                <button className="rounded-lg bg-white/15 px-3 py-1.5 font-medium">Salir</button>
              </form>
            ) : (
              <Link href="/login" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium">
                Entrar
              </Link>
            )}
          </div>
          <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2 text-sm font-medium">
            <NavLink href="/">Inicio</NavLink>
            <NavLink href="/ranking/masculino">Masculino</NavLink>
            <NavLink href="/ranking/femenino">Femenino</NavLink>
            {profile?.role === "admin" && <NavLink href="/admin">Admin</NavLink>}
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-4 pb-16">{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-white/15">
      {children}
    </Link>
  );
}
