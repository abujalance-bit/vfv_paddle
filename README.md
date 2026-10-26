# VFV Pádel

App web (pensada para móvil) para gestionar la liga de pádel por rankings: grupos de 4 equipos, todos contra todos en cada fase, el primero sube y el último baja.

- **Stack:** Next.js 15 + Tailwind 4, desplegado en Vercel. Base de datos y login en Supabase. Todo en plan gratuito.
- **Rankings:** Masculino y Femenino, cada uno con los grupos que crees (Grupo 1 = el más alto).
- **Fases:** cada fase tiene fecha de inicio y de fin (por ejemplo, del 19 oct al 14 nov). Al cerrar una fase, eliges las fechas de la siguiente.
- **Plazo de confirmación:** si el rival no confirma ni rechaza un resultado en 5 días, se da por bueno.
- **Notificaciones:** la campana avisa al rival cuando le suben un resultado, al equipo que lo subió cuando lo confirman o rechazan, y al admin cuando hay un rechazo.
- **Puntos:** victoria 3, derrota 1, no presentado 0, partido anulado 0 y 0.
- **Desempates:** los decide el admin a mano. Solo es obligatorio cuando el empate decide quién sube o quién baja.

## Cómo funciona

| Quién | Qué puede hacer |
|---|---|
| Cualquiera (sin entrar) | Ver clasificaciones, partidos, histórico de fases y avisos |
| Equipo (su usuario) | Subir el resultado de sus partidos (sets y los 2 jugadores de cada equipo), confirmar o rechazar lo que suba el rival, retirar un resultado suyo aún sin confirmar |
| Admin | Todo: equipos, jugadores, usuarios y contraseñas, grupos, poner o corregir cualquier resultado, desempates, cerrar la fase y avisos |

Cuando un equipo sube un resultado, al rival le sale un aviso destacado en Inicio. Si lo rechaza, el partido pasa a **En revisión** y aparece en el panel del admin.

Al **cerrar la fase**:
1. Todos los partidos tienen que estar confirmados o resueltos. Los no jugados los resuelve el admin: no presentado, anulado o con el resultado que él ponga.
2. El primero de cada grupo sube y el último baja.
3. Se abre la fase siguiente con los equipos recolocados y los partidos generados. Los equipos marcados como inactivos no pasan a la fase siguiente.

## Puesta en marcha

### 1. Supabase (base de datos)

1. Crea una cuenta en <https://supabase.com> (puedes entrar con GitHub) y un proyecto nuevo. Región: **Europe (Frankfurt o Paris)**.
2. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Después haz lo mismo con [`supabase/002_fases_avisos.sql`](supabase/002_fases_avisos.sql).
3. Ve a **Authentication → Sign In / Providers → Email** y **desactiva "Allow new users to sign up"**. Los usuarios solo los crea el admin desde la app.
4. Ve a **Project Settings → API Keys** y apunta:
   - Project URL (`https://xxxx.supabase.co`)
   - Publishable key (`sb_publishable_...`, o la antigua *anon*)
   - Secret key (`sb_secret_...`, o la antigua *service_role*). **No la compartas con nadie.**

> ⚠️ En el plan gratuito, Supabase **pausa el proyecto tras 7 días sin actividad**. Con la liga en marcha no pasa, pero en vacaciones puede ocurrir. Se reactiva con un clic desde el panel de Supabase.

### 2. Probar en local (opcional)

Hace falta **Node 22 o superior**, porque supabase-js ya no funciona con Node 20. Si tienes otra versión instalada, los comandos de abajo usan Node 22 a través de `npx -p node@22` sin tocar tu instalación.

```bash
cp .env.example .env.local      # y rellena las 3 claves
npm install
npx -p node@22 node --env-file=.env.local scripts/create-admin.mjs admin TuContraseñaSegura
npx -p node@22 next dev         # http://localhost:3000
```

### 3. Vercel (web)

1. Sube este repositorio a GitHub (puede ser privado).
2. Crea una cuenta en <https://vercel.com> con GitHub, pulsa **Add New → Project** e importa el repositorio.
3. En **Environment Variables** añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
4. Pulsa **Deploy**. Te da una URL del tipo `https://vfv-padel.vercel.app`.

Si no creaste el admin en el paso 2, créalo desde tu PC con el `.env.local` relleno:

```bash
npx -p node@22 node --env-file=.env.local scripts/create-admin.mjs admin TuContraseñaSegura
```

El mismo comando sirve para cambiar la contraseña del admin si se te olvida.

### 4. Primeros pasos en la app

1. Entra con tu usuario admin, ve a **Admin → Panel** y pulsa **Iniciar fase**.
2. En **Grupos**, crea los grupos de cada ranking.
3. En **Equipos**, crea cada equipo con sus 3 jugadores, su usuario, su contraseña y su grupo. Al completar un grupo, los partidos se generan solos.
4. Pásale a cada equipo su usuario, su contraseña y la URL.

### Instalar en el móvil

Abre la URL en el móvil:
- iPhone (Safari): **Compartir → Añadir a pantalla de inicio**.
- Android (Chrome): **⋮ → Añadir a pantalla de inicio / Instalar app**.

Se abre como una app más.

## Estructura

```
supabase/schema.sql        Tablas, seguridad (RLS) y funciones (subir/confirmar resultado, cerrar fase)
supabase/002_fases_avisos.sql  Fases por fechas, notificaciones y confirmación automática a los 5 días
scripts/create-admin.mjs   Crea o actualiza el usuario administrador
src/lib/standings.ts       Cálculo de la clasificación
src/app/page.tsx           Clasificación pública por ranking y fase
src/app/partido/[id]       Ficha del partido: subir, confirmar o rechazar resultado
src/app/admin/*            Panel de administración
```
