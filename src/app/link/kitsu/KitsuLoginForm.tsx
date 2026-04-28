"use client";

import {
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { enqueueSnackbar } from "notistack";
import { useState } from "react";
import { loginKitsuAction } from "@/lib/actions";

export default function KitsuLoginForm({
  configuredUsername,
}: {
  configuredUsername: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(configuredUsername);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("username", username);
      formData.set("password", password);
      const result = await loginKitsuAction(formData);
      if (!result.ok) {
        enqueueSnackbar(result.error, { variant: "error" });
        return;
      }
      router.push("/sync");
      router.refresh();
    } catch {
      enqueueSnackbar("Network error — please try again", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        Sign in with Kitsu
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your Kitsu username and password.
      </Typography>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label="Kitsu username or email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          disabled={loading || !!configuredUsername}
          helperText={
            configuredUsername
              ? "Pre-filled from server configuration"
              : undefined
          }
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading || !username || !password}
          sx={{ textTransform: "none" }}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
        </Button>
        <Link href="/link" underline="hover" sx={{ textAlign: "center" }}>
          ← Back to accounts
        </Link>
      </Box>
    </Container>
  );
}
