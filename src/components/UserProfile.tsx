import {
  Box,
  Container,
  Divider,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import UserFavorites from "@/components/UserFavorites";
import type { KitsuUserProfile } from "@/lib/kitsu/user";
import {
  ageFromBirthday,
  daysAgo,
  formatProfileDate,
  formatWatchTime,
} from "@/lib/kitsu/user";

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
          width: 140,
          borderBottom: "none",
          py: 0.75,
          pl: 0,
        }}
      >
        {label}
      </TableCell>
      <TableCell sx={{ borderBottom: "none", py: 0.75 }}>{children}</TableCell>
    </TableRow>
  );
}

export default function UserProfile({
  profile,
}: {
  profile: KitsuUserProfile;
}) {
  const joinFormatted = `${formatProfileDate(profile.createdAt)} (${daysAgo(profile.createdAt).toLocaleString()} days ago)`;
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
      {/* Banner */}
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
            unoptimized
            priority
          />
        </Box>
      )}

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
          About{" "}
          <MuiLink
            component={Link}
            href={`https://kitsu.app/users/${profile.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            color="inherit"
            title="View profile on Kitsu"
          >
            {profile.name}
          </MuiLink>
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 4,
            alignItems: "flex-start",
          }}
        >
          {/* Sidebar */}
          <Box sx={{ flexShrink: 0, width: { xs: "100%", md: 280 } }}>
            {/* Avatar + about */}
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

            {/* Profile details */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Table size="small">
                <TableBody>
                  <DetailRow label="Joined">{joinFormatted}</DetailRow>
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
                      <MuiLink
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        variant="body2"
                        sx={{ wordBreak: "break-all" }}
                      >
                        {profile.website}
                      </MuiLink>
                    </DetailRow>
                  )}
                  {profile.waifu && (
                    <DetailRow label={profile.waifu.label}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
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
                        <MuiLink
                          component={Link}
                          href={`https://kitsu.app/characters/${profile.waifu.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          variant="body2"
                        >
                          {profile.waifu.name}
                        </MuiLink>
                      </Box>
                    </DetailRow>
                  )}
                </TableBody>
              </Table>
            </Paper>

            {/* Stats */}
            {hasStats && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  User Stats
                </Typography>
                <Table size="small">
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

          {/* Main content – favorites */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
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
