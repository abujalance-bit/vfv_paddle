import { redirect } from "next/navigation";

// Enlaces antiguos /ranking/masculino → /?r=masculino
export default async function LegacyRankingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/?r=${encodeURIComponent(slug)}`);
}
