import * as React from "react";
import { Outlet, NavLink, useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Typography,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import { FiChevronDown, FiRefreshCw } from "react-icons/fi";
import { useAuth } from "../auth/useAuth";
import axios from "../../api/axiosInstance";

const orgAdminTabs = [
  { label: "Dashboard", path: "dashboard" },
  { label: "Organization", path: "organization" },
  { label: "Competency Dictionary", path: "competency-dictionary" },
];

export default function AdminShell() {
  const { orgId } = useParams();
  const { user, logout } = useAuth();
  const showOrgNav = (user?.role as string) !== "superadmin";

  // --- Fetch org name same as OrganizationDetailsPage ---
  const [orgName, setOrgName] = React.useState<string>(
    (user as any)?.org_name || "Organization"
  );
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orgId) return;
      try {
        const { data } = await axios.get<{ id: string; name: string }>(
          `/organizations/${orgId}/details`
        );
        if (mounted && data?.name) setOrgName(data.name);
      } catch {
        // silent fail fallback
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orgId]);

  // --- Org dropdown menu ---
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const openMenu = (e: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  // --- Soft reload handler (broadcast event) ---
  const handleSoftReload = React.useCallback(() => {
    const el = document.getElementById("reload-org-btn");
    el?.classList.add("spin");
    setTimeout(() => el?.classList.remove("spin"), 500);

    window.dispatchEvent(
      new CustomEvent("org-soft-reload", { detail: { orgId } })
    );
  }, [orgId]);

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
    background:
      "linear-gradient(90deg, var(--logo-blue) 0%, var(--logo-green) 100%)",
    boxShadow: "0 3px 12px rgba(55,174,129,0.22)",
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: "100vh",
      }}
    >
      {/* Top Navigation Bar */}
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
          {/* Left: Section title */}
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: "var(--color-text)" }}
          >
            COMAT
          </Typography>

          {/* Center: Navigation Tabs */}
          {showOrgNav && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {orgAdminTabs.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/org/${orgId}/${item.path}`}
                  end
                  style={({ isActive }) => ({
                    ...pillBase,
                    ...(isActive ? pillActive : {}),
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </Box>
          )}

          {/* Right: Reload + Org dropdown */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {/* Reload button (soft refresh) */}
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
                alignItems: "center",
                justifyContent: "center",
                borderColor: "var(--logo-blue)",
                "&:hover": { borderColor: "var(--logo-green)" },
              }}
            >
              <FiRefreshCw size={16} />
            </Button>

            {/* Org dropdown button */}
            <Button
              size="small"
              variant="outlined"
              onClick={openMenu}
              aria-controls={menuOpen ? "org-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={menuOpen ? "true" : undefined}
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
              {orgName}
              <FiChevronDown
                size={16}
                style={{
                  transition: "transform 0.2s ease",
                  transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
                  opacity: 0.8,
                }}
              />
            </Button>

            {/* Dropdown menu */}
            <Menu
              id="org-menu"
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={closeMenu}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem
                component={RouterLink}
                to={`/org/${orgId}/organization`}
                onClick={closeMenu}
              >
                Organization Details
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  closeMenu();
                  logout();
                }}
              >
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </Box>

      {/* Page Body */}
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: 2.5,
          py: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          width: "100%",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
