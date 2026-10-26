import Link from "next/link";
import { Suspense } from "react";
import { periodLabel, type Period, type Ranking } from "@/lib/types";
import { PeriodSelect } from "@/components/PeriodSelect";
import { ChevronDownIcon, ChevronUpIcon, MinusIcon } from "@/components/Icons";

type Props = {
  basePath: string;
  rankings: Ranking[];
  ranking: Ranking;
  periods: Period[];
  period: Period | null;
  showLegend?: boolean;
};

// Selector Masculino/Femenino + fase + leyenda
export function RankingFilters({ basePath, rankings, ranking, periods, period, showLegend }: Props) {
  const periodQuery = period ? `&periodo=${period.id}` : "";
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-full border border-line bg-panel p-1.5">
        {rankings.map((r) => (
          <Link
            key={r.id}
            href={`${basePath}?r=${r.slug}${periodQuery}`}
            className={`rounded-full px-6 py-2.5 text-base font-bold transition ${
              r.id === ranking.id ? "bg-lime text-ink" : "text-fg hover:text-lime"
            }`}
          >
            {r.name}
          </Link>
        ))}
      </div>

      <Suspense>
        <PeriodSelect
          value={period?.id ?? null}
          options={periods.map((p) => ({
            id: p.id,
            label: `${periodLabel(p)}${p.status === "open" ? " · En juego" : ""}`,
          }))}
        />
      </Suspense>

      {showLegend && (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 pt-1 text-xs text-muted sm:gap-x-5 sm:text-sm">
          <LegendItem bar="bg-up" icon={<ChevronUpIcon className="h-4 w-4 text-up" />} label="Asciende" />
          <LegendItem bar="bg-muted/60" icon={<MinusIcon className="h-4 w-4 text-muted" />} label="Mantiene" />
          <LegendItem bar="bg-down" icon={<ChevronDownIcon className="h-4 w-4 text-down" />} label="Desciende" />
        </div>
      )}
    </div>
  );
}

function LegendItem({ bar, icon, label }: { bar: string; icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-4 w-1.5 rounded-full ${bar}`} />
      {icon}
      {label}
    </span>
  );
}
