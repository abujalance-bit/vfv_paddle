import { createAdminClient } from "@/lib/supabase/admin";
import type { Announcement } from "@/lib/types";
import { Flash, type FlashParams } from "@/components/Flash";
import { createAnnouncement, deleteAnnouncement } from "../actions";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;
  const db = createAdminClient();
  const { data } = await db.from("announcements").select("*").order("created_at", { ascending: false });
  const announcements = (data ?? []) as Announcement[];

  return (
    <div className="space-y-4">
      <h1 className="h1">Avisos</h1>
      <Flash {...flash} />

      <form action={createAnnouncement} className="card space-y-3">
        <h2 className="h2">Nuevo aviso</h2>
        <input name="title" className="input" placeholder="Título" required />
        <textarea name="body" className="input" rows={4} placeholder="Texto (opcional)" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="pinned" className="h-4 w-4 accent-brand-600" />
          Fijar arriba
        </label>
        <button className="btn w-full">Publicar</button>
      </form>

      {announcements.map((a) => (
        <article key={a.id} className="card">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">
              {a.pinned && "📌 "}
              {a.title}
            </h3>
            <form action={deleteAnnouncement.bind(null, a.id)}>
              <button className="text-xs text-red-600">Borrar</button>
            </form>
          </div>
          {a.body && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{a.body}</p>}
        </article>
      ))}
    </div>
  );
}
