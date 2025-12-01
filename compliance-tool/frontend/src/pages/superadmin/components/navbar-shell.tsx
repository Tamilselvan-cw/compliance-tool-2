import * as React from "react";
import { Outlet, NavLink, useParams } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { FiRefreshCw } from "react-icons/fi";
import { useAuth } from "../../auth/useAuth";
import axios from "../../../api/axiosInstance";

const orgAdminTabs = [
  { label: "Organizations", path: "organizations" },
  { label: "Core Competencies", path: "core-competencies" },
];

export default function NavbarShell() {
  const { orgId } = useParams<{ orgId?: string }>();
  const { user, logout } = useAuth();

  /* ------------- SOFT RELOAD ---------------- */
  const handleSoftReload = () => {
    const el = document.getElementById("reload-org-btn");
    el?.classList.add("spin");
    setTimeout(() => el?.classList.remove("spin"), 500);

    window.dispatchEvent(new CustomEvent("org-soft-reload", { detail: { orgId } }));
  };

  /* -------------- TAB STYLES ---------------- */
  const pillBase: React.CSSProperties = {
    textDecoration: "none",
    borderRadius: 9999,
    fontWeight: 600,
    fontSize: "0.875rem",
    padding: "6px 14px",
    color: "var(--color-text)",
    background: "transparent",
    transition: "all 0.25s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const pillActive: React.CSSProperties = {
    color: "#fff",
    background: "linear-gradient(90deg, var(--logo-blue) 0%, var(--logo-green) 100%)",
    boxShadow: "0 3px 12px rgba(55,174,129,0.22)",
  };

  // Build link depending on whether orgId exists
  const buildLink = (path: string) => (orgId ? `/org/${orgId}/${path}` : `/${path}`);

  return (
    <Box sx={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: "100vh" }}>
      {/* Header */}
      <Box className="sticky top-0 z-20">
        <Box
          className="glass-card"
          sx={{
            maxWidth: 1200,
            mx: "auto",
            mt: 2,
            px: 2.5,
            py: 1.5,
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          {/* Left */}
          <Typography variant="h6" sx={{ fontWeight: 700, color: "var(--color-text)" }}>
            COMAT
          </Typography>

          {/* Center Nav - always visible (builds org-scoped links if orgId present, otherwise global) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {orgAdminTabs.map((item) => (
              <NavLink
                key={item.path}
                to={buildLink(item.path)}
                end
                style={({ isActive }) => ({ ...pillBase, ...(isActive ? pillActive : {}) })}
              >
                {item.label}
              </NavLink>
            ))}
          </Box>

          {/* Right */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              id="reload-org-btn"
              variant="outlined"
              size="small"
              onClick={handleSoftReload}
              sx={{
                minWidth: 36,
                width: 36,
                height: 36,
                p: 0,
                borderRadius: "50%",
                display: "flex",
                justifyContent: "center",
                borderColor: "var(--logo-blue)",
                "&:hover": { borderColor: "var(--logo-green)" },
              }}
            >
              <FiRefreshCw size={16} />
            </Button>

            <Button
              size="small"
              variant="outlined"
              onClick={() => logout()}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: "9999px",
                px: 1.5,
                py: 0.5,
                borderColor: "var(--logo-blue)",
                color: "var(--color-text)",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                "&:hover": { borderColor: "var(--logo-green)" },
              }}
            >
              Logout
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Body */}
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: 2.5,
          py: 2,
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
