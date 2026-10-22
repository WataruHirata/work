"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

const theme = createTheme({
  palette: {
    primary: { main: "#0b2f57", contrastText: "#ffffff" },
    secondary: { main: "#4f5f56" },
    warning: { main: "#b96c38", light: "#fff2e6" },
    success: { main: "#2c7a5f", light: "#ebf7f0" },
    background: { default: "#f5f8f6", paper: "#ffffff" },
    text: { primary: "#172720", secondary: "#4f5f56" },
    divider: "#e4ebe7",
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif',
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44, borderRadius: 8, paddingInline: 16 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderColor: "#e4ebe7", borderRadius: 12, boxShadow: "none" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 700 },
      },
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
