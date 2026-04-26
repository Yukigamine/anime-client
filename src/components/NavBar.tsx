"use client";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import MenuIcon from "@mui/icons-material/Menu";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PersonIcon from "@mui/icons-material/Person";
import SyncIcon from "@mui/icons-material/Sync";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ColorSchemeToggle from "@/components/ColorSchemeToggle";

const NAV_ITEMS = [
  {
    label: "Anime List",
    href: "/list/anime",
    icon: <LiveTvIcon fontSize="small" />,
  },
  {
    label: "Manga List",
    href: "/list/manga",
    icon: <MenuBookIcon fontSize="small" />,
  },
  {
    label: "About",
    href: "/me",
    icon: <PersonIcon fontSize="small" />,
  },
] as const;

const COLLECTION_ITEMS = [
  {
    label: "Anime Collection",
    href: "/collection/anime",
    icon: <VideoLibraryIcon fontSize="small" />,
  },
  {
    label: "Manga Collection",
    href: "/collection/manga",
    icon: <CollectionsBookmarkIcon fontSize="small" />,
  },
] as const;

export default function NavBar() {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [collectionAnchor, setCollectionAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            component={Link}
            href="/list/anime"
            sx={{
              fontWeight: 700,
              textDecoration: "none",
              color: "inherit",
              mr: 3,
            }}
          >
            Anime Client
          </Typography>

          {isMobile ? (
            <>
              <Box sx={{ flex: 1 }} />
              <ColorSchemeToggle />
              <IconButton color="inherit" onClick={() => setDrawerOpen(true)}>
                <MenuIcon />
              </IconButton>
            </>
          ) : (
            <>
              {NAV_ITEMS.map(({ label, href, icon }) => (
                <Button
                  key={href}
                  component={Link}
                  href={href}
                  startIcon={icon}
                  color={isActive(href) ? "primary" : "inherit"}
                  sx={{
                    textTransform: "none",
                    fontWeight: isActive(href) ? 700 : 400,
                    mr: 0.5,
                  }}
                >
                  {label}
                </Button>
              ))}

              {/* Collections dropdown */}
              <Button
                startIcon={<VideoLibraryIcon fontSize="small" />}
                endIcon={<ExpandMoreIcon fontSize="small" />}
                onClick={(e) => setCollectionAnchor(e.currentTarget)}
                color={isActive("/collection") ? "primary" : "inherit"}
                sx={{
                  textTransform: "none",
                  fontWeight: isActive("/collection") ? 700 : 400,
                  mr: 0.5,
                }}
              >
                Collection
              </Button>
              <Menu
                anchorEl={collectionAnchor}
                open={Boolean(collectionAnchor)}
                onClose={() => setCollectionAnchor(null)}
              >
                {COLLECTION_ITEMS.map(({ label, href, icon }) => (
                  <MenuItem
                    key={href}
                    component={Link}
                    href={href}
                    onClick={() => setCollectionAnchor(null)}
                    selected={isActive(href)}
                  >
                    <ListItemIcon>{icon}</ListItemIcon>
                    {label}
                  </MenuItem>
                ))}
              </Menu>

              <Box sx={{ flex: 1 }} />

              <Button
                component={Link}
                href="/sync"
                startIcon={<SyncIcon fontSize="small" />}
                color={isActive("/sync") ? "primary" : "inherit"}
                sx={{
                  textTransform: "none",
                  fontWeight: isActive("/sync") ? 700 : 400,
                  mr: 0.5,
                }}
              >
                Sync
              </Button>

              <ColorSchemeToggle />

              <IconButton
                component={Link}
                href="/login"
                color={isActive("/login") ? "primary" : "inherit"}
                title="Accounts"
              >
                <AccountCircleIcon />
              </IconButton>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 260 } } }}
      >
        <Toolbar />
        <List dense>
          {NAV_ITEMS.map(({ label, href, icon }) => (
            <ListItemButton
              key={href}
              component={Link}
              href={href}
              selected={isActive(href)}
              onClick={() => setDrawerOpen(false)}
            >
              <ListItemIcon>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}

          <Divider sx={{ my: 1 }} />
          <ListItemButton disabled>
            <ListItemIcon>
              <VideoLibraryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Collection"
              slotProps={{ primary: { sx: { fontWeight: 600, fontSize: 13 } } }}
            />
          </ListItemButton>

          {COLLECTION_ITEMS.map(({ label, href, icon }) => (
            <ListItemButton
              key={href}
              component={Link}
              href={href}
              selected={isActive(href)}
              onClick={() => setDrawerOpen(false)}
              sx={{ pl: 4 }}
            >
              <ListItemIcon>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}

          <Divider sx={{ my: 1 }} />

          <ListItemButton
            component={Link}
            href="/sync"
            selected={isActive("/sync")}
            onClick={() => setDrawerOpen(false)}
          >
            <ListItemIcon>
              <SyncIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sync" />
          </ListItemButton>

          <ListItemButton
            component={Link}
            href="/login"
            selected={isActive("/login")}
            onClick={() => setDrawerOpen(false)}
          >
            <ListItemIcon>
              <AccountCircleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Accounts" />
          </ListItemButton>
        </List>
      </Drawer>
    </>
  );
}
