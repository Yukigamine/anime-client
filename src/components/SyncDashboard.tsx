"use client";

import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import type { SyncLog } from "@/generated/prisma/client";

type AuthStatus = Record<
  "KITSU" | "ANILIST",
  { loggedIn: boolean; username: string | null }
>;
type StatusPayload = { logs: SyncLog[]; auth: AuthStatus };

const PROVIDER_LABELS = { KITSU: "Kitsu", ANILIST: "AniList" } as const;

export default function SyncDashboard() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [running, setRunning] = useState<string | null>(null); // "KITSU-PULL" etc.
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status");
      if (res.ok) setData(await res.json());
    } catch {
      // ignore transient errors
    }
  }, []);

  // Initial load + poll while something is running
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(fetchStatus, 2000);
    return () => clearInterval(id);
  }, [running, fetchStatus]);

  async function triggerSync(
    provider: "KITSU" | "ANILIST",
    direction: "PULL" | "PUSH",
  ) {
    const key = `${provider}-${direction}`;
    setRunning(key);
    setActionError(null);

    try {
      const res = await fetch(
        `/api/sync/${provider.toLowerCase()}?direction=${direction.toLowerCase()}`,
        { method: "POST" },
      );
      const body = await res.json();
      if (!res.ok) setActionError(body.error ?? "Sync failed");
    } catch {
      setActionError("Network error while starting sync");
    } finally {
      setRunning(null);
      await fetchStatus();
    }
  }

  const isRunning = (provider: string, direction: string) =>
    running === `${provider}-${direction}`;

  const lastLog = (provider: string, direction: string) =>
    data?.logs.find(
      (l) => l.provider === provider && l.direction === direction,
    );

  return (
    <Box>
      {actionError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      )}

      <Stack spacing={3}>
        {(["KITSU", "ANILIST"] as const).map((provider) => (
          <Paper key={provider} sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {PROVIDER_LABELS[provider]}
              </Typography>
              {data?.auth[provider].loggedIn ? (
                <Chip
                  label={`@${data.auth[provider].username}`}
                  color="success"
                  size="small"
                  variant="outlined"
                />
              ) : (
                <Chip
                  label="Not connected"
                  color="warning"
                  size="small"
                  variant="outlined"
                  component="a"
                  href="/login"
                  clickable
                />
              )}
            </Box>

            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
              {(["PULL", "PUSH"] as const).map((dir) => {
                const log = lastLog(provider, dir);
                const busy = isRunning(provider, dir);
                const canPush = dir === "PUSH" && data?.auth[provider].loggedIn;
                const canPull = dir === "PULL";
                const disabled = busy || (!canPull && !canPush);

                return (
                  <Box key={dir} sx={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Button
                      variant={dir === "PULL" ? "contained" : "outlined"}
                      startIcon={
                        busy ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : dir === "PULL" ? (
                          <CloudDownloadIcon />
                        ) : (
                          <CloudUploadIcon />
                        )
                      }
                      disabled={disabled}
                      onClick={() => triggerSync(provider, dir)}
                      sx={{ textTransform: "none", mb: 1.5 }}
                      fullWidth
                    >
                      {busy
                        ? "Running…"
                        : `${dir === "PULL" ? "Pull from" : "Push to"} ${PROVIDER_LABELS[provider]}`}
                    </Button>

                    {log && (
                      <LastRunSummary
                        log={log}
                        expanded={expandedLog === log.id}
                        onToggle={() =>
                          setExpandedLog(expandedLog === log.id ? null : log.id)
                        }
                      />
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        ))}
      </Stack>

      {/* Recent sync history */}
      {data && data.logs.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Recent runs
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1}>
            {data.logs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                expanded={expandedLog === log.id}
                onToggle={() =>
                  setExpandedLog(expandedLog === log.id ? null : log.id)
                }
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function statusColor(status: string) {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "error";
  return "warning";
}

function LastRunSummary({
  log,
  expanded,
  onToggle,
}: {
  log: SyncLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const errors = (log.errors as string[]) ?? [];

  return (
    <Box sx={{ fontSize: 12 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Chip
          label={log.status}
          color={statusColor(log.status) as "success" | "error" | "warning"}
          size="small"
        />
        <Typography variant="caption" color="text.secondary">
          {new Date(log.startedAt).toLocaleString()}
        </Typography>
        {log.status === "RUNNING" && <CircularProgress size={12} />}
      </Box>
      {log.status !== "RUNNING" && (
        <Typography variant="caption" color="text.secondary">
          {log.animeSynced} anime · {log.mangaSynced} manga
        </Typography>
      )}
      {errors.length > 0 && (
        <Button
          size="small"
          color="error"
          startIcon={<ErrorOutlineIcon />}
          onClick={onToggle}
          sx={{ textTransform: "none", p: 0, mt: 0.5 }}
        >
          {errors.length} error{errors.length > 1 ? "s" : ""}
        </Button>
      )}
      <Collapse in={expanded}>
        <Box
          component="ul"
          sx={{ m: 0, pl: 2, mt: 0.5, color: "error.main", fontSize: 11 }}
        >
          {errors.map((e, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <li key={i}>{e}</li>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: SyncLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const errors = (log.errors as string[]) ?? [];

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
      >
        <Chip
          label={PROVIDER_LABELS[log.provider as "KITSU" | "ANILIST"]}
          size="small"
        />
        <Chip label={log.direction} size="small" variant="outlined" />
        <Chip
          label={log.status}
          size="small"
          color={statusColor(log.status) as "success" | "error" | "warning"}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto" }}
        >
          {new Date(log.startedAt).toLocaleString()}
          {log.finishedAt && (
            <>
              {" "}
              (
              {Math.round(
                (new Date(log.finishedAt).getTime() -
                  new Date(log.startedAt).getTime()) /
                  1000,
              )}
              s)
            </>
          )}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {log.animeSynced} anime · {log.mangaSynced} manga
      </Typography>
      {errors.length > 0 && (
        <>
          <Button
            size="small"
            color="error"
            startIcon={<ErrorOutlineIcon />}
            onClick={onToggle}
            sx={{ textTransform: "none", p: 0, alignSelf: "flex-start" }}
          >
            {errors.length} error{errors.length > 1 ? "s" : ""}
          </Button>
          <Collapse in={expanded}>
            <Box
              component="ul"
              sx={{ m: 0, pl: 2, color: "error.main", fontSize: 11 }}
            >
              {errors.map((e, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static list
                <li key={i}>{e}</li>
              ))}
            </Box>
          </Collapse>
        </>
      )}
    </Paper>
  );
}
