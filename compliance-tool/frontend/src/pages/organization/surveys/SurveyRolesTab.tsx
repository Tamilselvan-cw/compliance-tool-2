import * as React from "react";
import {
  Box, Button, Checkbox, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, Alert, CircularProgress
} from "@mui/material";
import { useParams } from "react-router-dom";
import axios from "../../../api/axiosInstance";
import { store } from "./surveysStore";
import { toast } from "../../../components/hooks/use-toast";

type RoleMini = { id: string; name?: string; title?: string };

export default function SurveyRolesTab() {
  const { orgId = "", surveyId = "" } = useParams();

  const [roles, setRoles] = React.useState<RoleMini[]>([]);
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // bootstrap: load org roles + survey meta (to get selected role_ids)
  React.useEffect(() => {
    let on = true;
    (async () => {
      if (!orgId || !surveyId) return;
      setLoading(true);
      setErr(null);
      try {
        const [rolesRes, surveyRes] = await Promise.all([
          axios.get<{ items: RoleMini[] }>(`/organizations/${orgId}/roles`, { params: { page: 1, limit: 200 } }),
          axios.get<{ id: string; role_ids?: string[] }>(`/organizations/${orgId}/surveys/${surveyId}`)
        ]);

        if (!on) return;
        const allRoles = rolesRes.data.items || [];
        const selected = new Set((surveyRes.data.role_ids || []).filter(Boolean));

        setRoles(allRoles);
        setChecked(Object.fromEntries(allRoles.map(r => [r.id, selected.has(r.id)])));
      } catch (e: any) {
        // Fallback to local store if server meta fails
        const local = store.get(surveyId);
        if (local?.role_ids?.length) {
          try {
            const rolesRes = await axios.get<{ items: RoleMini[] }>(
              `/organizations/${orgId}/roles`, { params: { page: 1, limit: 200 } }
            );
            if (!on) return;
            const allRoles = rolesRes.data.items || [];
            const selected = new Set(local.role_ids);
            setRoles(allRoles);
            setChecked(Object.fromEntries(allRoles.map(r => [r.id, selected.has(r.id)])));
            setErr(e?.response?.data?.detail || e?.message || "Failed to load survey; showing local data.");
          } catch (e2: any) {
            setErr(e2?.response?.data?.detail || e2?.message || "Failed to load roles.");
          }
        } else {
          setErr(e?.response?.data?.detail || e?.message || "Failed to load survey/roles.");
        }
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [orgId, surveyId]);

  const onToggle = (id: string, val: boolean) =>
    setChecked(prev => ({ ...prev, [id]: val }));

  const save = async () => {
    const role_ids = Object.keys(checked).filter(k => checked[k]);
    if (!role_ids.length) {
      toast({ title: "Pick at least one role", variant: "destructive" as any });
      return;
    }
    setSaving(true);
    try {
      // Try server save
      await axios.patch(`/organizations/${orgId}/surveys/${surveyId}`, { role_ids });
      toast({ title: "Roles updated" });
    } catch (e: any) {
      // Fallback to local store if PATCH not implemented
      const survey = store.get(surveyId);
      if (survey) {
        store.setRoleIds(surveyId, role_ids);
        toast({ title: "Roles updated (local)" });
      } else {
        throw e;
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ p: 2 }}><CircularProgress size={20} /></Box>;
  return (
    <Box className="glass rounded-2xl" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Choose roles
      </Typography>

      {err && <Alert severity="warning" sx={{ mb: 1 }}>{err}</Alert>}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={48} />
            <TableCell>Role</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {roles.map(r => (
            <TableRow key={r.id} hover>
              <TableCell>
                <Checkbox
                  checked={!!checked[r.id]}
                  onChange={(e) => onToggle(r.id, e.target.checked)}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {r.name || r.title || "Untitled"}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
        <Button className="theme-button" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </Box>
    </Box>
  );
}
