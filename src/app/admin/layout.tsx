import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/fases", label: "Fases" },
  { href: "/admin/equipos", label: "Equipos" },
  { href: "/admin/grupos", label: "Grupos" },
  { href: "/admin/partidos", label: "Partidos" },
  { href: "/admin/mes", label: "Cerrar fase" },
  { href: "/admin/avisos", label: "Avisos" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-full bg-panel px-3 py-1.5 text-sm font-medium text-fg/85 ring-1 ring-line"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
