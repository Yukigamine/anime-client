import SyncIcon from "@mui/icons-material/Sync";
import { Box, Button, Container, Typography } from "@mui/material";
import AnimeListClient from "@/components/AnimeListClient";
import { getAnimeList, getListCounts } from "@/lib/list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Anime List",
};

export default async function ListPage() {
  const [entries, counts] = await Promise.all([
    getAnimeList(),
    getListCounts(),
  ]);

  const lastSync = entries.reduce(
    (latest, e) => {
      const t = e.kitsuSyncedAt ?? e.anilistSyncedAt;
      if (!t) return latest;
      return latest ? (t > latest ? t : latest) : t;
    },
    null as Date | null,
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 4,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Anime List
          </Typography>
          {lastSync && (
            <Typography variant="caption" color="text.secondary">
              Last synced {lastSync.toLocaleDateString()}{" "}
              {lastSync.toLocaleTimeString()}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <SyncButton source="kitsu" label="Sync Kitsu" />
          <SyncButton source="anilist" label="Sync AniList" />
        </Box>
      </Box>

      {entries.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 12 }}>
          <Typography variant="h5" color="text.secondary" gutterBottom>
            No anime entries yet
          </Typography>
          <Typography variant="body1" color="text.disabled">
            Use the sync buttons above to import your list from Kitsu or
            AniList.
          </Typography>
        </Box>
      ) : (
        <AnimeListClient entries={entries} counts={counts} />
      )}
    </Container>
  );
}

function SyncButton({ source, label }: { source: string; label: string }) {
  return (
    <form action={`/api/sync/${source}`} method="post">
      <Button
        type="submit"
        variant="outlined"
        size="small"
        startIcon={<SyncIcon />}
        sx={{ textTransform: "none" }}
      >
        {label}
      </Button>
    </form>
  );
}
