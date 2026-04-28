"use client";

import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useState } from "react";
import type { SyncLog } from "@/generated/prisma/client";
import {
  getSyncStatusAction,
  type SyncStatusPayload,
  triggerSyncAction,
} from "@/lib/actions";

const PROVIDER_LABELS = { KITSU: "Kitsu", ANILIST: "AniList" } as const;

export default function SyncDashboard() {
  const [data, setData] = useState<SyncStatusPayload | null>(null);
  const [running, setRunning] = useState<string | null>(null); // "KITSU-PULL" etc.
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [expandedRecent, setExpandedRecent] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setData(await getSyncStatusAction());
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
    setRunning(`${provider}-${direction}`);
    const result = await triggerSyncAction(provider, direction);
    if (!result.ok) enqueueSnackbar(result.error, { variant: "error" });
    setRunning(null);
    await fetchStatus();
  }

  const isRunning = (provider: string, direction: string) =>
    running === `${provider}-${direction}`;

  const lastLog = (provider: string, direction: string) =>
    data?.logs.find(
      (l) => l.provider === provider && l.direction === direction,
    );

  return (
    <Box>
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
                  href="/link"
                  clickable
                />
              )}
            </Box>

            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
              {(["PULL", "PUSH"] as const).map((dir) => {
                const log = lastLog(provider, dir);
                const busy = isRunning(provider, dir);
                const isConnected = data?.auth[provider].loggedIn;
                const disabled = busy || !isConnected;

                const button = (
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
                );

                return (
                  <Box key={dir} sx={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Tooltip
                      title={
                        disabled && !busy
                          ? "Connect your account to enable this action"
                          : ""
                      }
                      disableInteractive
                    >
                      <span>{button}</span>
                    </Tooltip>

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
                expanded={expandedRecent === log.id}
                onToggle={() =>
                  setExpandedRecent(expandedRecent === log.id ? null : log.id)
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
  if (status === "CANCELLED") return "default";
  return "warning";
}

function LogDetails({
  errors,
  deletions,
  expanded,
  onToggle,
  compact,
}: {
  errors: string[];
  deletions: string[];
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const hasErrors = errors.length > 0;
  const hasDeletions = deletions.length > 0;
  if (!hasErrors && !hasDeletions) return null;

  return (
    <>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {hasErrors && (
          <Button
            size="small"
            color="error"
            startIcon={<ErrorOutlineIcon />}
            onClick={onToggle}
            sx={{
              textTransform: "none",
              p: 0,
              ...(compact ? { ml: 1.5 } : { alignSelf: "flex-start" }),
            }}
          >
            {errors.length} error{errors.length > 1 ? "s" : ""}
          </Button>
        )}
        {hasDeletions && (
          <Button
            size="small"
            color="warning"
            startIcon={<DeleteOutlineIcon />}
            onClick={onToggle}
            sx={{
              textTransform: "none",
              p: 0,
              ...(compact ? {} : { alignSelf: "flex-start" }),
            }}
          >
            {deletions.length} deleted
          </Button>
        )}
      </Box>
      <Collapse in={expanded}>
        {hasErrors && (
          <Box
            component="ul"
            sx={{ m: 0, pl: 2, mt: 0.5, color: "error.main", fontSize: 11 }}
          >
            {errors.map((e, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <li key={i}>{e}</li>
            ))}
          </Box>
        )}
        {hasDeletions && (
          <Box
            component="ul"
            sx={{ m: 0, pl: 2, mt: 0.5, color: "warning.main", fontSize: 11 }}
          >
            {deletions.map((d, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <li key={i}>Deleted {d}</li>
            ))}
          </Box>
        )}
      </Collapse>
    </>
  );
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
  const deletions = (log.deletions as string[]) ?? [];

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
          {log.animeSynced} anime
          {log.animeChanged ? ` (${log.animeChanged} changed)` : ""} ·{" "}
          {log.mangaSynced} manga
          {log.mangaChanged ? ` (${log.mangaChanged} changed)` : ""}
        </Typography>
      )}
      <LogDetails
        errors={errors}
        deletions={deletions}
        expanded={expanded}
        onToggle={onToggle}
        compact
      />
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
  const deletions = (log.deletions as string[]) ?? [];

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
        {log.animeSynced} anime
        {log.animeChanged ? ` (${log.animeChanged} changed)` : ""} ·{" "}
        {log.mangaSynced} manga
        {log.mangaChanged ? ` (${log.mangaChanged} changed)` : ""}
      </Typography>
      <LogDetails
        errors={errors}
        deletions={deletions}
        expanded={expanded}
        onToggle={onToggle}
      />
    </Paper>
  );
}
