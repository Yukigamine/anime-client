"use client";

import { Typography } from "@mui/material";
import { useKitsuProfile } from "@/lib/hooks/useKitsuProfile";

type Props = {
  mediaTitle: string;
};

export default function KitsuOwnedMediaTitle({ mediaTitle }: Props) {
  const username = process.env.NEXT_PUBLIC_KITSU_USERNAME ?? "";
  const { data: profile } = useKitsuProfile(username);
  const title = profile?.name ? `${profile.name}'s ${mediaTitle}` : mediaTitle;

  return (
    <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
      {title}
    </Typography>
  );
}
