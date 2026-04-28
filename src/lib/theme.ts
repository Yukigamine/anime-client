import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
  },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#7c6af7" },
        secondary: { main: "#e879a0" },
        background: {
          default: "#f6f5ff",
          paper: "#ffffff",
        },
      },
    },
    dark: {
      palette: {
        primary: { main: "#9d8fff" },
        secondary: { main: "#f48fb1" },
        background: {
          default: "#0f0f1a",
          paper: "#1a1a2e",
        },
      },
    },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body": {
          maxWidth: "100vw",
          overflowX: "hidden",
        },
      },
    },
  },
});

export default theme;
