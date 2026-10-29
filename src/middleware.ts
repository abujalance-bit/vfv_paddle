import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refresca la sesión si ha caducado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión solo se puede ver la pantalla de entrar
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Cuenta una visita cuando el usuario vuelve tras un rato sin usar la app.
  // La cookie se renueva en cada petición y caduca a los 30 minutos de inactividad.
  if (user) {
    if (!request.cookies.has(VISIT_COOKIE)) await supabase.rpc("track_visit");
    response.cookies.set(VISIT_COOKIE, "1", { maxAge: VISIT_WINDOW_SECONDS, httpOnly: true, sameSite: "lax", path: "/" });
  }

  return response;
}

const VISIT_COOKIE = "vfv_visit";
const VISIT_WINDOW_SECONDS = 30 * 60;

export const config = {
  // Fuera quedan los ficheros estáticos (logo, iconos, imágenes) que necesita la pantalla de entrar
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
