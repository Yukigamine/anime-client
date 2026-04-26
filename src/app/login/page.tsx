import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import KeyIcon from "@mui/icons-material/Key";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Typography,
} from "@mui/material";
import type { Metadata } from "next";
import { getAuthStatus } from "@/lib/auth";

export const metadata: Metadata = { title: "Login – Anime Client" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [auth, params] = await Promise.all([getAuthStatus(), searchParams]);
  const error = params.error;

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Connect your accounts
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Link Kitsu and/or AniList to enable two-way sync of your anime and manga
        lists.
      </Typography>

      {error && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            bgcolor: "error.dark",
            borderRadius: 2,
            color: "error.contrastText",
          }}
        >
          <Typography variant="body2">{decodeURIComponent(error)}</Typography>
        </Box>
      )}

      {/* Kitsu card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}
          >
            <KeyIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Kitsu
            </Typography>
            {auth.KITSU.loggedIn && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  ml: "auto",
                }}
              >
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="caption" color="success.main">
                  {auth.KITSU.username}
                </Typography>
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sign in with your Kitsu username and password using the OAuth
            password grant.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              href="/login/kitsu"
              sx={{ textTransform: "none" }}
            >
              {auth.KITSU.loggedIn ? "Re-authenticate" : "Sign in with Kitsu"}
            </Button>
            {auth.KITSU.loggedIn && (
              <LogoutButton provider="KITSU" label="Disconnect" />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* AniList card */}
      <Card>
        <CardContent>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}
          >
            <OpenInNewIcon color="secondary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AniList
            </Typography>
            {auth.ANILIST.loggedIn && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  ml: "auto",
                }}
              >
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="caption" color="success.main">
                  {auth.ANILIST.username}
                </Typography>
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Authorize via AniList OAuth. You&apos;ll be redirected to AniList to
            approve access, then returned here.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              color="secondary"
              href="/api/auth/anilist"
              sx={{ textTransform: "none" }}
            >
              {auth.ANILIST.loggedIn
                ? "Re-authorize AniList"
                : "Authorize AniList"}
            </Button>
            {auth.ANILIST.loggedIn && (
              <LogoutButton provider="ANILIST" label="Disconnect" />
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

function LogoutButton({
  provider,
  label,
}: {
  provider: string;
  label: string;
}) {
  return (
    <form action={`/api/auth/logout?provider=${provider}`} method="post">
      <Button
        type="submit"
        variant="outlined"
        color="error"
        size="small"
        sx={{ textTransform: "none" }}
      >
        {label}
      </Button>
    </form>
  );
}
