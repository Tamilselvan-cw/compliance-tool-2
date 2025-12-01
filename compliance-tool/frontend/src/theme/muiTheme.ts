// src/theme/muiTheme.ts
import { createTheme } from "@mui/material/styles";

const baseTheme = createTheme({
  palette: {
    primary: { main: "#42BF61", light: "#6BD488", dark: "#2E8544", contrastText: "#FFFFFF" },
    secondary: { main: "#007FBE", light: "#3399CC", dark: "#005885", contrastText: "#FFFFFF" },
    background: { default: "#FFFFFF", paper: "#FFFFFF" },
    text: { primary: "#1A1A1A", secondary: "#666666" },
  },

  // 👇 Font family from your global.css :root variable
  typography: {
    fontFamily: "var(--font-family-sans)",

    // --- Headings ---
    h1: { fontSize: "3rem", fontWeight: 700, lineHeight: 1.2 }, // ≈48px
    h2: { fontSize: "2.5rem", fontWeight: 600, lineHeight: 1.25 }, // ≈40px
    h3: { fontSize: "2rem", fontWeight: 600, lineHeight: 1.3 }, // ≈32px
    h4: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.35 }, // ≈24px
    h5: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.4 }, // ≈20px
    h6: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.45 }, // ≈16px

    // --- Body text ---
    body1: { fontSize: "1rem", lineHeight: 1.6, fontWeight: 400 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5, fontWeight: 400 },

    // --- Captions & buttons ---
    caption: { fontSize: "0.75rem", lineHeight: 1.4, color: "var(--color-text-2)" },
    button: { textTransform: "none", fontWeight: 600, fontSize: "0.9375rem" }, // 15px
    subtitle1: { fontSize: "0.875rem", fontWeight: 600 },
    subtitle2: { fontSize: "0.8125rem", fontWeight: 500 },
  },

  shape: { borderRadius: 12 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body, #root": { fontFamily: "var(--font-family-sans)" },
      },
    },

    MuiTypography: {
      styleOverrides: { root: { fontFamily: "var(--font-family-sans)" } },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          padding: "8px 20px",
          fontSize: "1rem",
          boxShadow: "none",
          "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
        },
        sizeLarge: { padding: "16px 40px", fontSize: "1.125rem" },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
          transition: "all .3s ease",
          "&:hover": {
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
            transform: "translateY(-4px)",
          },
        },
      },
    },
  },
});

// ✅ Add DataGrid font inheritance (avoid TS complaints)
(baseTheme as any).components.MuiDataGrid = {
  styleOverrides: { root: { fontFamily: "var(--font-family-sans)" } },
};

export const theme = baseTheme;
