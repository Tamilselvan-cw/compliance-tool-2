import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./shared/styles/global.css";
import { AuthProvider } from "./pages/auth/AuthContext";
import axiosInstance from "./api/axiosInstance";
import { ThemeProvider } from "@mui/material";
import { theme } from "./theme/muiTheme";

const t = localStorage.getItem("access_token");
if (t) axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${t}`;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
      <ThemeProvider theme={theme}>
      <AuthProvider>
        <App />
      </AuthProvider>
      </ThemeProvider>
  </React.StrictMode>
);
