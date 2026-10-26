import { HERO_SRC } from "@/lib/brand";

type Stat = { label: string; value: number };

export function Hero({ subtitle, stats }: { subtitle: string; stats: Stat[] }) {
  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-line bg-cover bg-center"
      style={{ backgroundImage: `url(${HERO_SRC})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/75 to-ink/30" />
      <div className="relative px-6 pb-7 pt-8 sm:px-10">
        <h1 className="font-display text-[38px] font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
          Ranking
          <br />
          <span className="whitespace-nowrap">
            Equipos <span className="text-lime">VFV</span>
          </span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg/85">{subtitle}</p>
        <dl className="mt-7 flex gap-8">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</dt>
              <dd className="mt-1 font-mono text-4xl font-bold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
