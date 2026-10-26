"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecksIcon, TrophyIcon, UsersIcon } from "@/components/Icons";

type Props = { myTeamId: string | null; pendingCount: number };

export function NavTabs({ myTeamId, pendingCount }: Props) {
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: "Clasificación", icon: TrophyIcon, active: pathname === "/" },
    { href: "/resultados", label: "Resultados", icon: ListChecksIcon, active: pathname.startsWith("/resultados") },
    ...(myTeamId
      ? [{ href: `/equipo/${myTeamId}`, label: "Mi equipo", icon: UsersIcon, active: pathname === `/equipo/${myTeamId}` }]
      : []),
  ];

  // Con tres pestañas, en móvil se quitan los iconos para que quepan
  const compact = tabs.length > 2;

  return (
    <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3">
      {tabs.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          className={`relative flex items-center gap-2 whitespace-nowrap rounded-2xl py-2.5 text-sm font-semibold transition ${
            compact ? "px-3 sm:px-4" : "px-4"
          } ${
            active ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"
          }`}
        >
          <Icon className={`h-[18px] w-[18px] ${compact ? "hidden sm:block" : ""}`} />
          {label}
          {label === "Mi equipo" && pendingCount > 0 && (
            <span className="ml-0.5 rounded-full bg-lime px-1.5 text-[11px] font-black text-ink">{pendingCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
