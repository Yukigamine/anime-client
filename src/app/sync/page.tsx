import { Container, Typography } from "@mui/material";
import type { Metadata } from "next";
import SyncDashboard from "@/components/SyncDashboard";

export const metadata: Metadata = { title: "Sync – Anime Client" };

export default function SyncPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Sync
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Pull imports the latest data from Kitsu or AniList into your local
        database. Push writes your local changes back to the provider.
      </Typography>
      <SyncDashboard />
    </Container>
  );
}
