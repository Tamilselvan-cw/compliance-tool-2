// src/pages/organization/surveys/SurveyListPage.tsx
import * as React from "react";
import {
  Box, Button, Card, CardActionArea, CardContent, Checkbox, Dialog,
  DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography, IconButton, Tooltip, CircularProgress, TextField
} from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import { FiPlus, FiX, FiCheckSquare, FiSquare } from "react-icons/fi";
import { toast } from "../../../components/hooks/use-toast";
import axios from "@/api/axiosInstance";
import { FiClipboard, FiTarget, FiBarChart2 } from "react-icons/fi";
import { FiUsers } from "react-icons/fi";


/** Role shape from API */
type OrgRole = {
  id: string;
  organization_id: string;
  title?: string;
  name?: string;
};
const roleDisplayName = (r: OrgRole) => r.title ?? r.name ?? "";

/** Survey row returned by backend */
type SurveyRow = {
  id: string;
  org_id: string;
  title: string;
  description?: string | null;
  status: "draft" | "active" | "closed";
  role_ids?: string[] | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;  // ISO
  updated_at?: string;  // ISO
};

type SurveyListResponse = { items: SurveyRow[]; total?: number } | SurveyRow[];

export default function SurveyListPage() {
  const { orgId = "acme" } = useParams();

  const [surveys, setSurveys] = React.useState<SurveyRow[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);

  const [open, setOpen] = React.useState(false);

  const [surveyName, setSurveyName] = React.useState("");
  const [surveyDesc, setSurveyDesc] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [roles, setRoles] = React.useState<OrgRole[]>([]);
  const [loadingRoles, setLoadingRoles] = React.useState(false);

  const [checked, setChecked] = React.useState<Record<string, boolean>>({});

  const surveyParticipantsPath = React.useCallback(
    (sid: string) =>
      `/org/${orgId}/organization/surveys/${encodeURIComponent(sid)}/participants`,
    [orgId]
  );

  const loadRoles = async (orgIdStr: string) => {
    try {
      setLoadingRoles(true);
      const { data } = await axios.get<{ items: OrgRole[]; total: number }>(
        `/organizations/${orgIdStr}/roles`,
        { params: { page: 1, limit: 200 } }
      );
      setRoles(data?.items ?? []);
      setChecked({});
    } catch (err: any) {
      toast({
        title: `Failed to load roles: ${err?.response?.data?.detail || err?.message || "Unknown error"}`,
        variant: "destructive" as any,
      });
      setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  };

  const loadSurveys = React.useCallback(async () => {
    if (!orgId) return;
    try {
      setLoadingList(true);
      const { data } = await axios.get<SurveyListResponse>(
        `/organizations/${orgId}/surveys`,
        { params: { page: 1, limit: 50 } }
      );
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      setSurveys(items);
    } catch (err: any) {
      toast({
        title: `Failed to load surveys: ${err?.response?.data?.detail || err?.message || "Unknown error"}`,
        variant: "destructive" as any,
      });
      setSurveys([]);
    } finally {
      setLoadingList(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  const createAndPickRoles = async () => {
    setSurveyName("");
    setSurveyDesc("");
    setChecked({});
    setOpen(true);
    if (orgId) loadRoles(orgId);
  };

  const confirmRoles = async () => {
    if (!orgId) return;
    const role_ids = Object.keys(checked).filter(k => checked[k]);

    if (!surveyName.trim()) {
      toast({ title: "Survey name is required", variant: "destructive" as any });
      return;
    }
    if (!role_ids.length) {
      toast({ title: "Pick at least one role", variant: "destructive" as any });
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: surveyName.trim(),
        description: surveyDesc.trim() || null,
        role_ids,
        status: "draft" as const,
      };

      const { data } = await axios.post(`/organizations/${orgId}/surveys`, payload);
      const serverId = (data as any)?.id || (data as any)?.data?.id;
      if (!serverId) throw new Error("Survey created but no id returned.");

      setOpen(false);
      // Optional refresh (not strictly needed if you jump away)
      loadSurveys();

      toast({ title: `Survey created: ${surveyName}` });

      // Navigate after dialog closes, to participants
      window.requestAnimationFrame(() => {
        window.location.assign(surveyParticipantsPath(serverId));
      });
    } catch (err: any) {
      toast({
        title: `Failed to create survey: ${err?.response?.data?.detail || err?.message || "Unknown error"}`,
        variant: "destructive" as any,
      });
    } finally {
      setCreating(false);
    }
  };

  const noneSelected = roles.every(r => !checked[r.id]);

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    for (const r of roles) next[r.id] = true;
    setChecked(next);
  };
  const unselectAll = () => setChecked({});

  return (
    <Box>
      <Box className="glass-card rounded-2xl p-3 mb-3 flex items-center justify-between">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Surveys</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {loadingList && <CircularProgress size={16} />}
          <Button className="theme-button" size="small" onClick={createAndPickRoles}>
            <FiPlus style={{ marginRight: 8 }} /> New Survey
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
{surveys.map((s) => {
  const rolesCount = s.role_ids?.length ?? 0;
  const createdAt = s.created_at
  ? new Date(s.created_at)
      .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      .replace(/\./g, "")
      .replace(/ /g, "-")
  : "";


  // status-based icon tint (kept green badge for consistency)
  const Icon = s.status === "active" ? FiBarChart2 : s.status === "draft" ? FiClipboard : FiTarget;
  const tint  = s.status === "active" ? "#22c55e" : s.status === "draft" ? "#3b82f6" : "#9ca3af";

  return (
    <Card
      key={s.id}
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "20px",
        border: "1px solid var(--color-border)",
        // ✅ white → mild grey gradient
        background: "linear-gradient(180deg, #ffffff 0%, #f6f7f9 100%)",
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 16px 36px rgba(0,0,0,0.14)",
          borderColor: "rgba(0,0,0,0.08)",
        },
      }}
    >
      {/* small status badge at top-right */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          px: 0.75,
          py: 0.25,
          fontSize: 11,
          lineHeight: 1.2,
          borderRadius: 999,
          bgcolor: `${tint}1A`, // 10% tint
          color: tint,
          border: "1px solid rgba(0,0,0,0.06)",
          textTransform: "capitalize",
          fontWeight: 700,
        }}
      >
        {s.status}
      </Box>

<CardActionArea
  component={RouterLink}
  to={surveyParticipantsPath(s.id)}
  sx={{
    height: "100%",
    textDecoration: "none", // remove global underline
    "&:hover": {
      textDecoration: "none",
    },
    // ✅ Only affect the title
    "&:hover .survey-title": {
      textDecoration: "underline",
      color: "#22c55e", // bright green highlight
    },
  }}
>

        <CardContent sx={{ p: 2.25, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* green icon badge (kept) */}
          <Box
            sx={{
              width: 46, height: 46, mb: 1.25,
              borderRadius: "14px",
              display: "grid", placeItems: "center",
              background: "linear-gradient(180deg, rgba(34,197,94,0.18), transparent)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <Icon size={20} color="#22c55e" />
          </Box>

          {/* title (gets underline on hover only) */}
          <Typography
            className="survey-title"
            variant="subtitle1"
            sx={{ fontWeight: 800, mb: 0.75, lineHeight: 1.15, textDecoration: "none" }}
          >
            {s.title}
          </Typography>

          {/* roles pill: icon + number */}
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 999,
                fontSize: 12,
                lineHeight: 1.2,
                bgcolor: "rgba(0,0,0,0.06)",
                color: "var(--color-text)",
              }}
            >
              <FiUsers size={14} />
              <strong style={{ fontWeight: 700 }}>{rolesCount}</strong>
              <span style={{ opacity: 0.7 }}>roles</span>
            </Box>
          </Stack>

          {/* footer meta */}
          <Typography variant="caption" sx={{ mt: "auto", color: "var(--color-text-2)" }}>
            {createdAt} {s.created_by ? `· ${s.created_by}` : ""}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
})}



        {!surveys.length && !loadingList && (
          <Box className="glass rounded-2xl" sx={{ p: 3, textAlign: "center", color: "var(--color-text-2)" }}>
            No surveys yet. Click “New Survey” to start.
          </Box>
        )}
      </Box>

      {/* Create survey modal */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            New Survey
            {loadingRoles && <CircularProgress size={16} sx={{ ml: 1 }} />}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip title="Select all">
              <span>
                <IconButton size="small" onClick={selectAll} disabled={!roles.length}>
                  <FiCheckSquare />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Unselect all">
              <span>
                <IconButton size="small" onClick={unselectAll} disabled={noneSelected}>
                  <FiSquare />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton onClick={() => setOpen(false)}><FiX /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2.5 }}>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Survey details</Typography>
            <TextField
              size="small"
              label="Survey name"
              placeholder="e.g., H1 2025 Competency Survey"
              value={surveyName}
              onChange={(e) => setSurveyName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              size="small"
              label="Description"
              placeholder="Short description (optional)"
              value={surveyDesc}
              onChange={(e) => setSurveyDesc(e.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Choose roles
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={48} />
                <TableCell>Role</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((r) => {
                const c = !!checked[r.id];
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Checkbox
                        checked={c}
                        onChange={(e) => setChecked((m) => ({ ...m, [r.id]: e.target.checked }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {roleDisplayName(r)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!roles.length && !loadingRoles && (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography variant="body2" color="text.secondary">
                      No roles found for this organization.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => setOpen(false)} disabled={creating}>Cancel</Button>
            <Button
              className="theme-button"
              onClick={confirmRoles}
              disabled={creating || !surveyName.trim() || Object.keys(checked).every((k) => !checked[k])}
            >
              {creating ? "Creating…" : "Create & Continue"}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
