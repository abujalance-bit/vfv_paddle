"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, ChevronDownIcon } from "@/components/Icons";

type Option = { id: string; label: string };

export function PeriodSelect({ options, value }: { options: Option[]; value: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="relative flex w-full items-center rounded-2xl border border-line bg-panel sm:w-80">
      <CalendarIcon className="pointer-events-none absolute left-4 h-5 w-5 text-sky-400" />
      <select
        aria-label="Fase"
        value={value ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("periodo", e.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="w-full appearance-none bg-transparent py-3 pl-12 pr-10 text-base font-medium text-fg outline-none"
      >
        {options.length === 0 && <option value="">Fase</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-panel">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-4 h-5 w-5 text-muted" />
    </label>
  );
}
