import { Flash, type FlashParams } from "@/components/Flash";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;

  return (
    <div className="mx-auto max-w-sm pt-6">
      <h1 className="h1 mb-4">Entrar</h1>
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
      <p className="mt-4 text-center text-sm text-gray-500">
        ¿No tienes usuario? Pídeselo al administrador de la liga.
      </p>
    </div>
  );
}
