import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";

export const metadata: Metadata = { title: "Anime Collection – Anime Client" };
export const dynamic = "force-dynamic";

const FORMAT_LABELS = {
  DVD: "DVD",
  BLU_RAY: "Blu-ray",
  VHS: "VHS",
  DIGITAL: "Digital",
  LIMITED_EDITION: "Limited Edition",
  OTHER: "Other",
} as const;

const CONDITION_COLORS = {
  MINT: "success",
  NEAR_MINT: "success",
  GOOD: "primary",
  FAIR: "warning",
  POOR: "error",
} as const;

export default async function AnimeCollectionPage() {
  const items = await prisma.animeCollectionItem.findMany({
    include: { anime: true },
    orderBy: [{ anime: { titleEn: "asc" } }, { createdAt: "asc" }],
  });

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Anime Collection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled
          sx={{ textTransform: "none" }}
        >
          Add item (coming soon)
        </Button>
      </Box>

      {items.length === 0 ? (
        <Stack spacing={2} sx={{ py: 10, alignItems: "center" }}>
          <Typography variant="h5" color="text.secondary">
            Your collection is empty
          </Typography>
          <Typography
            sx={{ color: "text.disabled", textAlign: "center", maxWidth: 400 }}
          >
            Track your physical and digital anime collection here. Adding and
            editing items will be available in a future update.
          </Typography>
        </Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Format</TableCell>
                <TableCell>Condition</TableCell>
                <TableCell>Purchased</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const title =
                  item.anime.titleEn ??
                  item.anime.titleRomaji ??
                  item.anime.titleJp ??
                  "Unknown";
                return (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{title}</TableCell>
                    <TableCell>
                      {FORMAT_LABELS[item.format] ?? item.format}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.condition}
                        color={
                          CONDITION_COLORS[item.condition] as
                            | "success"
                            | "primary"
                            | "warning"
                            | "error"
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {item.purchasedAt
                        ? new Date(item.purchasedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {item.pricePaid != null
                        ? `$${item.pricePaid.toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}
