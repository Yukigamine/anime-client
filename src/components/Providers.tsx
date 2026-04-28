"use client";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import {
  type CustomContentProps,
  SnackbarContent,
  type SnackbarKey,
  SnackbarProvider,
  useSnackbar,
} from "notistack";
import { forwardRef } from "react";
import SWRProvider from "@/components/SWRProvider";
import theme from "@/lib/theme";

const SuccessSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  (props, ref) => {
    const { message } = props;
    const { closeSnackbar } = useSnackbar();
    return (
      <SnackbarContent ref={ref} role="alert">
        <Alert
          severity="success"
          action={
            <IconButton
              color="inherit"
              onClick={() => closeSnackbar(props.id as SnackbarKey)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <Typography sx={{ fontWeight: 300 }}>{message}</Typography>
        </Alert>
      </SnackbarContent>
    );
  },
);
SuccessSnackbar.displayName = "SuccessSnackbar";

const ErrorSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  (props, ref) => {
    const { message } = props;
    const { closeSnackbar } = useSnackbar();
    return (
      <SnackbarContent ref={ref} role="alert">
        <Alert
          severity="error"
          action={
            <IconButton
              color="inherit"
              onClick={() => closeSnackbar(props.id as SnackbarKey)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <Typography sx={{ fontWeight: 300 }}>{message}</Typography>
        </Alert>
      </SnackbarContent>
    );
  },
);
ErrorSnackbar.displayName = "ErrorSnackbar";

const InfoSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  (props, ref) => {
    const { message } = props;
    const { closeSnackbar } = useSnackbar();
    return (
      <SnackbarContent ref={ref} role="alert">
        <Alert
          severity="info"
          action={
            <IconButton
              color="inherit"
              onClick={() => closeSnackbar(props.id as SnackbarKey)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <Typography sx={{ fontWeight: 300 }}>{message}</Typography>
        </Alert>
      </SnackbarContent>
    );
  },
);
InfoSnackbar.displayName = "InfoSnackbar";

const WarningSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  (props, ref) => {
    const { message } = props;
    const { closeSnackbar } = useSnackbar();
    return (
      <SnackbarContent ref={ref} role="alert">
        <Alert
          severity="warning"
          action={
            <IconButton
              color="inherit"
              onClick={() => closeSnackbar(props.id as SnackbarKey)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <Typography sx={{ fontWeight: 300 }}>{message}</Typography>
        </Alert>
      </SnackbarContent>
    );
  },
);
WarningSnackbar.displayName = "WarningSnackbar";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          autoHideDuration={5000}
          Components={{
            success: SuccessSnackbar,
            error: ErrorSnackbar,
            info: InfoSnackbar,
            warning: WarningSnackbar,
          }}
        >
          <SWRProvider>{children}</SWRProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
