import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { LOGO_SRC } from "@/lib/brand";
import { Flash, type FlashParams } from "@/components/Flash";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  if (await getProfile()) redirect("/");
  const flash = await searchParams;

  return (
    <div className="mx-auto max-w-sm pt-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-white ring-8 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="Pádel X4" className="h-full w-full object-contain p-1" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-black uppercase leading-none tracking-tight">
          Ranking Equipos <span className="text-lime">VFV</span>
        </h1>
        <p className="mt-2 text-sm text-muted">Entra con el usuario y la contraseña de tu equipo.</p>
      </div>
      <Flash {...flash} />
      <form action={signIn} className="card space-y-4">
        <div>
          <label className="label" htmlFor="username">Usuario del equipo</label>
          <input id="username" name="username" className="input" autoCapitalize="none" autoComplete="username" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
        </div>
        <button className="btn w-full">Entrar</button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">¿No tienes usuario? Pídeselo al administrador de la liga.</p>
    </div>
  );
}
