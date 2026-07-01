"use client";

import { Box, Card, CardContent, CardMedia, Typography } from "@mui/material";

type Chip = {
  label: string;
  color: string;
  icon?: React.ReactNode;
};

type Props = {
  image: string;
  imageAlt: string;
  title: string;
  actions: React.ReactNode;
  chips: Chip[];
};

export function CollectionCard({
  image,
  imageAlt,
  title,
  actions,
  chips,
}: Props) {
  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <CardMedia
        component="img"
        image={image}
        alt={imageAlt}
        sx={{
          height: 280,
          objectFit: "cover",
        }}
      />
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
            mb: 1,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              flex: 1,
            }}
          >
            {title}
          </Typography>
          <Box sx={{ flexShrink: 0 }}>{actions}</Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            flexWrap: "wrap",
          }}
        >
          {chips.map((chip) => (
            <Box
              key={`${chip.label}-${chip.color}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.25,
                bgcolor: chip.color,
                borderRadius: 1,
              }}
            >
              {chip.icon && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: "1.2em",
                  }}
                >
                  {chip.icon}
                </Box>
              )}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {chip.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
