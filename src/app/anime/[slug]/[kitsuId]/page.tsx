import type { Metadata } from "next";
import ProviderMediaDetailPage from "@/components/ProviderMediaDetailPage";
import prisma from "@/lib/prisma";

export const metadata: Metadata = { title: "Anime Details – Tsuki Client" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; kitsuId: string }> };

export default async function AnimeDetailPage({ params }: Props) {
  const { slug, kitsuId } = await params;
  const anime = await prisma.anime.findUnique({
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
      mediaType="anime"
      mediaId={anime?.id ?? null}
      anilistId={anime?.anilistId ?? null}
      listEntry={anime?.listEntry ?? null}
      collectionCount={anime?.collectionItems.length ?? 0}
      collectionFormats={
        anime?.collectionItems.map((item) => item.format) ?? []
      }
      collectionItems={anime?.collectionItems ?? []}
    />
  );
}
