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
      <SyncDashboard />
    </Container>
  );
}
