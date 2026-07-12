import { Box, Container, Typography } from "@mui/material";
import type { Metadata } from "next";
import { MangaCollectionItemForm } from "@/components/MangaCollectionItemForm";

export const metadata: Metadata = {
  title: "Add to Manga Collection – Tsuki Client",
};

export default function AddMangaCollectionItemPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Add manga to collection
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Search for a title and fill in the details for your item.
        </Typography>
      </Box>
      <MangaCollectionItemForm />
    </Container>
  );
}
