"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7c6af7",
    },
    secondary: {
      main: "#f48fb1",
    },
    background: {
      default: "#0f0f1a",
      paper: "#1a1a2e",
    },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), sans-serif",
  },
  shape: {
    borderRadius: 10,
  },
});

export default theme;
