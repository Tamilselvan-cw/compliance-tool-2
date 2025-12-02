// src/pages/organization/org/OrganizationDetailsPage.tsx
import * as React from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Chip,
  Button,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Skeleton,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import {
  FiLayers,
  FiUsers,
  FiBriefcase,
  FiTrendingUp,
  FiZap,
  FiClipboard,
} from "react-icons/fi";
import axios from "../../../api/axiosInstance";
import { useQuery } from "@tanstack/react-query";

/* ---------------- Types ---------------- */

type OrgDTO = {
  id: string;
  name: string;
  email?: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  description?: string | null;
  number?: string | null;
  counts?: {
    departments: number;
    roles: number;
    employees: number;
    levels: number;
    competencys: number;
    surveys: number;
  };
};

type AdminUser = {
  id: string;
  email: string;
  full_name?: string | null;
  status?: "pending" | "active" | "disabled" | string | null;
  created_at?: string | null;
  verified_at?: string | null;
};

type AdminsResp = {
  active: AdminUser[];
  pending: AdminUser[];
};

/* ---------------- Styles / small components ---------------- */

const compactFieldSx = {
  mb: 1,
  "& .MuiInputBase-input": {
    fontSize: 13,
    paddingTop: 0.75,
    paddingBottom: 0.75,
  },
  "& .MuiInputLabel-root": { fontSize: 12 },
  "& .MuiFormHelperText-root": { fontSize: 11 },
} as const;

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, fontSize: 13 }}>
    {children}
  </Typography>
);

function OrgDetailsSkeleton() {
  return (
    <Box sx={{ width: "100%", minWidth: "320px" }}>
      <Skeleton variant="text" width="30%" height={30} sx={{ mb: 2 }} />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={160}
        sx={{ mb: 2, borderRadius: 2 }}
      />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={140}
        sx={{ mb: 2, borderRadius: 2 }}
      />
    </Box>
  );
}

/* ---------------- React Query helpers ---------------- */

async function fetchOrgDetails(orgId: string): Promise<OrgDTO> {
  const { data } = await axios.get<OrgDTO>(`/organizations/${orgId}/details`);
  return data;
}

async function fetchOrgAdmins(orgId: string): Promise<AdminsResp> {
  try {
    const [activeRes, pendingRes] = await Promise.all([
      axios.get<AdminUser[]>(`/organizations/${orgId}/admins`, {
        params: { status: "active" },
      }),
      axios.get<AdminUser[]>(`/organizations/${orgId}/admins`, {
        params: { status: "pending" },
      }),
    ]);
    return {
      active: activeRes.data || [],
      pending: pendingRes.data || [],
    };
  } catch {
    const allRes = await axios.get<AdminUser[]>(`/organizations/${orgId}/admins`);
    const all = allRes.data || [];
    return {
      active: all.filter((u) => (u.status || "").toLowerCase() === "active"),
      pending: all.filter((u) => (u.status || "").toLowerCase() === "pending"),
    };
  }
}

/* ---------------- Page ---------------- */

export default function OrganizationDashboardPage() {
  const { orgId } = useParams();

  const {
    data: org,
    isLoading: orgLoading,

    refetch: refetchOrg,
  } = useQuery<OrgDTO>({
    queryKey: ["org-details", orgId],
    queryFn: () => fetchOrgDetails(orgId as string),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // soft-loading cache
    refetchOnWindowFocus: false,
  });

  const {
    data: adminsData,
    isLoading: adminsLoading,

    refetch: refetchAdmins,
  } = useQuery<AdminsResp>({
    queryKey: ["org-admins", orgId],
    queryFn: () => fetchOrgAdmins(orgId as string),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activeAdmins = adminsData?.active ?? [];
  const invitedAdmins = adminsData?.pending ?? [];

  // local edit + UI state
  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", description: "" });
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [adminTab, setAdminTab] = React.useState<0 | 1>(0);

  // initialise form when org changes
  React.useEffect(() => {
    if (!org) return;
    setForm({
      name: org.name || "",
      description: org.description || "",
    });
    setDirty(false);
  }, [org]);

  // soft reload listener: same as other pages
  React.useEffect(() => {
    const handler = (e: any) => {
      const targetOrg = e.detail?.orgId;
      if (!targetOrg || targetOrg === orgId) {
        refetchOrg();
        refetchAdmins();
      }
    };
    window.addEventListener("org-soft-reload", handler);
    return () => window.removeEventListener("org-soft-reload", handler);
  }, [orgId, refetchOrg, refetchAdmins]);

  const statusChip = (s?: string | null) => {
    const v = (s || "").toLowerCase();
    const color =
      v === "active" ? "success" : v === "pending" ? "warning" : "default";
    const label = v ? v[0].toUpperCase() + v.slice(1) : "—";
    return (
      <Chip
        size="small"
        label={label}
        color={color as any}
        variant="outlined"
        sx={{ ml: 1 }}
      />
    );
  };

  const renderAdminsList = (
    rows: AdminUser[],
    expected: "active" | "pending"
  ) => {
    if (adminsLoading && !adminsData)
      return <div className="text-sm text-gray-500">Loading admins…</div>;

    const filtered = rows.filter(
      (u) => (u.status || "").toLowerCase() === expected
    );
    if (!filtered.length)
      return (
        <div className="text-sm text-gray-500">No users in this tab.</div>
      );

    return (
      <List dense disablePadding>
        {filtered.map((u) => (
          <ListItem key={u.id} sx={{ px: 0 }}>
            <ListItemAvatar>
              <Avatar>
                {(u.full_name || u.email || "?").slice(0, 1).toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Typography
                    component="span"
                    sx={{ fontWeight: 600, mr: 1 }}
                  >
                    {u.full_name || u.email}
                  </Typography>
                  {statusChip(u.status)}
                </Box>
              }
              secondary={u.email}
            />
          </ListItem>
        ))}
      </List>
    );
  };

  const onCopyId = async () => {
    try {
      await navigator.clipboard.writeText(org?.id || "");
    } catch {
      // ignore
    }
  };

  const setField = (k: keyof typeof form, v: string) => {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      const changed =
        next.name !== (org?.name || "") ||
        next.description !== (org?.description || "");
      setDirty(changed);
      return next;
    });
  };

  const onSave = async () => {
    if (!dirty || !orgId || !org) return;
    setSaving(true);
    try {
      const patch: Partial<OrgDTO> = {};
      if (form.name !== (org.name || "")) patch.name = form.name.trim();
      if (form.description !== (org.description || ""))
        patch.description = form.description.trim();

      if (!Object.keys(patch).length) {
        setDirty(false);
        setIsEditing(false);
        return;
      }

      await axios.patch<OrgDTO>(`/organizations/${orgId}`, patch);
      await refetchOrg();
      setIsEditing(false);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const onInviteAdmin = async () => {
    if (!orgId || !inviteEmail.trim()) return;
    try {
      await axios.post(`/organizations/${orgId}/admins`, {
        email: inviteEmail.trim(),
      });
      setInviteOpen(false);
      setInviteEmail("");
      await refetchAdmins();
    } catch {
      // ignore error for now
    }
  };

  if (orgLoading && !org) return <OrgDetailsSkeleton />;

  if (!org) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Organization not found.
        </Typography>
      </Box>
    );
  }

  const c = org.counts || {
    departments: 0,
    roles: 0,
    employees: 0,
    levels: 0,
    competencys: 0,
    surveys: 0,
  };

  return (
    <Box sx={{ width: "100%" }}>
      {/* Basic Info */}
      <Box
        className="glass"
        sx={{
          p: 2,
          mb: 1,
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
          width: "100%",
        }}
        onDoubleClick={() => setIsEditing(true)}
        title="Double-click to edit name/description"
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          Basic Information
        </Typography>

        <TextField
          label="Organization Name"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          fullWidth
          size="small"
          margin="dense"
          InputProps={{ readOnly: !isEditing }}
          sx={compactFieldSx}
        />

        <TextField
          label="Phone"
          value={org.number ?? ""}
          fullWidth
          size="small"
          margin="dense"
          InputProps={{ readOnly: true }}
          sx={{ ...compactFieldSx, mb: 1.25 }}
        />

        <SectionLabel>Description</SectionLabel>
        <TextField
          value={isEditing ? form.description : org.description}
          onChange={(e) => setField("description", e.target.value)}
          fullWidth
          size="small"
          margin="dense"
          multiline
          minRows={2}
          InputProps={{ readOnly: !isEditing }}
          sx={compactFieldSx}
        />

        {isEditing && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={onSave}
              disabled={!dirty || saving}
            >
              Save
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<CloseIcon />}
              onClick={() => {
                setIsEditing(false);
                // reset form to original org values
                setForm({
                  name: org.name || "",
                  description: org.description || "",
                });
                setDirty(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: 1,
            mb: 0.5,
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{ color: "var(--color-text-2)", display: "block" }}
            >
              Organization ID
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                color: "var(--color-text)",
                mt: 0.25,
              }}
            >
              {org.id}
            </Typography>
          </Box>

          <Tooltip title="Copy organization ID">
            <IconButton size="small" onClick={onCopyId}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Admins + Counts in one row */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 1,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        {/* Admin Users */}
        <Box
          className="glass"
          sx={{
            p: 2,
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: 1,
            flex: 1,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 800, fontSize: 13 }}
            >
              Admin Users
            </Typography>
            {/* <Button size="small" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)}>
              Add admin
            </Button> */}
          </Box>

          <Tabs
            value={adminTab}
            onChange={(_, v) => setAdminTab(v)}
            textColor="inherit"
            indicatorColor="primary"
            variant="fullWidth"
            sx={{
              minHeight: 36,
              "& .MuiTab-root": {
                minHeight: 36,
                fontSize: 13,
                textTransform: "none",
              },
            }}
          >
            <Tab
              label={`Active admins (${
                activeAdmins.filter(
                  (a) => (a.status || "").toLowerCase() === "active"
                ).length
              })`}
            />
            {/* <Tab
              label={`Invited admins (${
                invitedAdmins.filter((a) => (a.status || "").toLowerCase() === "pending").length
              })`}
            /> */}
          </Tabs>

          <Box role="tabpanel" hidden={adminTab !== 0} sx={{ pt: 1 }}>
            {renderAdminsList(activeAdmins, "active")}
          </Box>
          <Box role="tabpanel" hidden={adminTab !== 1} sx={{ pt: 1 }}>
            {renderAdminsList(invitedAdmins, "pending")}
          </Box>
        </Box>

        {/* Counts */}
        <Box
          className="glass"
          sx={{
            p: 2,
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-border)",
            flex: 1,
            minWidth: 0,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 800, fontSize: 13, mb: 1 }}
          >
            Counts
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" },
              gap: 1.25,
            }}
          >
            {[
              {
                key: "departments",
                label: "Departments",
                value: c.departments,
                icon: FiLayers,
                tint: "#3b82f6",
              },
              {
                key: "roles",
                label: "Roles",
                value: c.roles,
                icon: FiBriefcase,
                tint: "#8b5cf6",
              },
              {
                key: "employees",
                label: "Employees",
                value: c.employees,
                icon: FiUsers,
                tint: "#06b6d4",
              },
              {
                key: "levels",
                label: "Levels",
                value: c.levels,
                icon: FiTrendingUp,
                tint: "#22c55e",
              },
              {
                key: "competencys",
                label: "competencys",
                value: c.competencys,
                icon: FiZap,
                tint: "#f59e0b",
              },
              {
                key: "surveys",
                label: "Reports",
                value: c.surveys,
                icon: FiClipboard,
                tint: "#ef4444",
              },
            ].map(({ key, label, value, icon: Icon, tint }) => (
              <Box
                key={key}
                sx={{
                  position: "relative",
                  border: "1px solid var(--color-border)",
                  borderRadius: "16px",
                  p: 1.25,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  overflow: "hidden",
                  backdropFilter: "blur(6px)",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.14) 100%)",
                  transition:
                    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
                    borderColor: "rgba(255,255,255,0.28)",
                  },
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(600px 120px at -20% -40%, ${tint}22 0%, transparent 50%)`,
                    pointerEvents: "none",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: "12px",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(255,255,255,0.32)",
                    background: `linear-gradient(180deg, ${tint}22, transparent)`,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={tint} />
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    lineHeight: 1.1,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "var(--color-text-2)",
                      fontSize: 12,
                      opacity: 0.9,
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      m: 0,
                      fontWeight: 800,
                      fontSize: 20,
                      color: "var(--color-text)",
                    }}
                  >
                    {value}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Invite Admin Dialog */}
      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add admin user</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            size="small"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button onClick={onInviteAdmin} variant="contained">
            Invite
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
