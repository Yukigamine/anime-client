import type { Metadata } from "next";
import ProviderMediaDetailPage from "@/components/ProviderMediaDetailPage";
import prisma from "@/lib/prisma";

export const metadata: Metadata = { title: "Manga Details – Tsuki Client" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; kitsuId: string }> };

export default async function MangaDetailPage({ params }: Props) {
  const { slug, kitsuId } = await params;
  const manga = await prisma.manga.findUnique({
    where: { kitsuId },
    select: {
      id: true,
      anilistId: true,
      listEntry: true,
      collectionItems: true,
    },
  });

  return (
    <ProviderMediaDetailPage
      kitsuId={kitsuId}
      fallbackTitle={slug}
      mediaType="manga"
      mediaId={manga?.id ?? null}
      anilistId={manga?.anilistId ?? null}
      listEntry={manga?.listEntry ?? null}
      collectionCount={manga?.collectionItems.length ?? 0}
      collectionItems={manga?.collectionItems ?? []}
    />
  );
}
