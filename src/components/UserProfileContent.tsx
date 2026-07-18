"use client";

import {
  Box,
  Container,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import Image from "next/image";
import { enqueueSnackbar } from "notistack";
import { useEffect } from "react";
import Link from "@/components/Link";
import ProfileSkeleton from "@/components/ProfileSkeleton";
import UserFavorites from "@/components/UserFavorites";
import { useKitsuProfile } from "@/lib/hooks/useKitsuProfile";
import {
  ageFromBirthday,
  formatElapsedSince,
  formatProfileDate,
  formatWatchTime,
} from "@/lib/kitsu/user-types";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell
        sx={{
          fontWeight: 600,
          color: "text.secondary",
          whiteSpace: "nowrap",
          width: 110,
          borderBottom: "none",
          py: 0.75,
          pl: 0,
        }}
      >
        {label}
      </TableCell>
      <TableCell
        sx={{
          borderBottom: "none",
          py: 0.75,
          pr: 0,
          textAlign: "right",
        }}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

export default function UserProfileContent({ username }: { username: string }) {
  const { data: profile, error, isLoading } = useKitsuProfile(username);

  useEffect(() => {
    if (error) {
      enqueueSnackbar(`Failed to load profile: ${error.message}`, {
        variant: "error",
      });
    }
  }, [error]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Unable to load profile
        </Typography>
        <Typography color="text.secondary">
          We could not load this Kitsu profile right now.
        </Typography>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Profile not found
        </Typography>
        <Typography color="text.secondary">
          The requested Kitsu user could not be found.
        </Typography>
      </Container>
    );
  }

  const joinedDate = formatProfileDate(profile.createdAt);
  const joinedElapsed = formatElapsedSince(profile.createdAt);
  const birthdayFormatted = profile.birthday
    ? `${formatProfileDate(profile.birthday)} (age ${ageFromBirthday(profile.birthday)})`
    : null;

  const hasStats =
    profile.stats.animeSeries != null || profile.stats.mangaSeries != null;
  const hasFavorites = Object.values(profile.favorites).some(
    (arr) => arr.length > 0,
  );

  return (
    <Box>
      {profile.bannerUrl && (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: { xs: 120, md: 200 },
            bgcolor: "action.hover",
            overflow: "hidden",
          }}
        >
          <Image
            src={profile.bannerUrl}
            alt="Profile banner"
            fill
            style={{ objectFit: "cover" }}
            priority
            loading="eager"
          />
        </Box>
      )}

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
          About{" "}
          <Link
            href={`https://kitsu.app/users/${profile.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            color="inherit"
            title="View profile on Kitsu"
          >
            {profile.name}
          </Link>
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 4,
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ flexShrink: 0, width: { xs: "100%", md: 340 } }}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  alignItems: "flex-start",
                  mb: profile.about ? 2 : 0,
                }}
              >
                {profile.avatarUrl && (
                  <Box
                    sx={{
                      position: "relative",
                      width: 80,
                      height: 80,
                      borderRadius: 2,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.name}
                      fill
                      sizes="80px"
                      style={{ objectFit: "cover" }}
                      unoptimized
                    />
                  </Box>
                )}
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, lineHeight: 1.2 }}
                  >
                    {profile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    @{profile.slug}
                  </Typography>
                </Box>
              </Box>
              {profile.about && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: "pre-wrap" }}
                >
                  {profile.about}
                </Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                <TableBody>
                  <DetailRow label="Joined">
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                      <span>{joinedDate}</span>
                      <span>({joinedElapsed} ago)</span>
                    </Box>
                  </DetailRow>
                  {birthdayFormatted && (
                    <DetailRow label="Birthday">{birthdayFormatted}</DetailRow>
                  )}
                  {profile.gender && (
                    <DetailRow label="Gender">{profile.gender}</DetailRow>
                  )}
                  {profile.location && (
                    <DetailRow label="Location">{profile.location}</DetailRow>
                  )}
                  {profile.website && (
                    <DetailRow label="Website">
                      <Link
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        variant="body2"
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {profile.website}
                      </Link>
                    </DetailRow>
                  )}
                  {profile.waifu && (
                    <DetailRow label={profile.waifu.label}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: 1,
                        }}
                      >
                        {profile.waifu.imageUrl && (
                          <Box
                            sx={{
                              position: "relative",
                              width: 36,
                              height: 36,
                              borderRadius: 1,
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            <Image
                              src={profile.waifu.imageUrl}
                              alt={profile.waifu.name}
                              fill
                              sizes="36px"
                              style={{ objectFit: "cover" }}
                              unoptimized
                            />
                          </Box>
                        )}
                        <Link
                          href={`https://kitsu.app/characters/${profile.waifu.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          variant="body2"
                        >
                          {profile.waifu.name}
                        </Link>
                      </Box>
                    </DetailRow>
                  )}
                </TableBody>
              </Table>
            </Paper>

            {hasStats && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  User Stats
                </Typography>
                <Table
                  size="small"
                  sx={{ tableLayout: "fixed", width: "100%" }}
                >
                  <TableBody>
                    {profile.stats.animeTimeSecs != null && (
                      <DetailRow label="Time watching">
                        {formatWatchTime(profile.stats.animeTimeSecs)}
                      </DetailRow>
                    )}
                    {profile.stats.animeSeries != null && (
                      <DetailRow label="Anime series">
                        {profile.stats.animeSeries.toLocaleString()}
                      </DetailRow>
                    )}
                    {profile.stats.animeEpisodes != null && (
                      <DetailRow label="Episodes watched">
                        {profile.stats.animeEpisodes.toLocaleString()}
                      </DetailRow>
                    )}
                    {profile.stats.mangaSeries != null && (
                      <DetailRow label="Manga series">
                        {profile.stats.mangaSeries.toLocaleString()}
                      </DetailRow>
                    )}
                    {profile.stats.mangaChapters != null && (
                      <DetailRow label="Chapters read">
                        {profile.stats.mangaChapters.toLocaleString()}
                      </DetailRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Box>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              width: { xs: "100%", md: "auto" },
            }}
          >
            {hasFavorites ? (
              <>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                  Favorites
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <UserFavorites favorites={profile.favorites} />
              </>
            ) : (
              <Typography variant="body1" color="text.secondary">
                No favorites listed.
              </Typography>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
