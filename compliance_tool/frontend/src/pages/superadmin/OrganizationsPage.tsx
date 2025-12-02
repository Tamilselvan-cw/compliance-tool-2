import * as React from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { FiPlus, FiSearch } from "react-icons/fi";
import OrganizationCard, { type OrgItem } from "../../components/specific/OrganizationCard";
import { toast } from "../../components/hooks/use-toast";
import OrgDrawer from "../../components/specific/OrgDrawer";
import axios from "../../api/axiosInstance";
import NavbarShell from "./components/navbar-shell"; // adjust path if needed

/* ---------- Types ---------- */
type OrgDTO = {
  id: string;
  name: string;
  created_at: string;
  status: string;
  email?: string | null;
  description?: string | null;
};

type OrgListResponse = { items: OrgDTO[] };

type CreateOrgResponse = {
  organization: OrgDTO;
  admins: Array<{ email?: string | null }>;
};

const REQUIRED_KEYS: (keyof OrgDTO)[] = ["id", "name", "created_at", "status"];

/* Debounce */
function useDebounced(value: string, delay = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* Extract Errors */
function extractErr(e: any): string {
  return (
    e?.response?.data?.detail?.message ||
    e?.response?.data?.detail ||
    e?.message ||
    "Something went wrong"
  );
}

/* ========================================================= */

export default function OrganizationsPage() {
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [orgs, setOrgs] = React.useState<OrgItem[]>([]);

  const [drawer, setDrawer] = React.useState<
    | { mode: "create"; open: boolean }
    | { mode: "details"; open: boolean; org: OrgItem }
    | { open: false }
  >({ open: false });

  /* ---------------- Organization delete popup ---------------- */
  const [confirmDelete, setConfirmDelete] = React.useState({
    open: false,
    id: "",
    name: "",
  });

  /* ---------------- Admin delete popup ---------------- */
  const [confirmAdminDelete, setConfirmAdminDelete] = React.useState({
    open: false,
    orgId: "",
    adminId: "",
    adminName: "",
  });

  /* ---- Invite Admin Users ---- */
  const handleInviteAdmins = async (
    orgId: string,
    admins: Array<{ name: string; email: string }>
  ) => {
    try {
      await Promise.all(
        admins.map((a) =>
          axios.post(`/organizations/${orgId}/employees`, {
            name: a.name,
            email: a.email,
            role: "org_admin",
          })
        )
      );

      toast({
        title: "Admins invited",
        description: `${admins.length} user(s) invited.`,
      });

      if (drawer.open && drawer.mode === "details") {
        setDrawer({
          mode: "details",
          open: true,
          org: drawer.org,
        });
      }
    } catch (err) {
      toast({
        title: "Invite failed",
        description: extractErr(err),
        variant: "destructive",
      });
    }
  };

  const debouncedQ = useDebounced(q, 400);

  /* ---------- Load organizations ---------- */
  const loadOrgs = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<OrgListResponse>("/organizations", {
        params: { search: debouncedQ || undefined },
      });

      const rows = data.items ?? [];

      const mapped = rows
        .filter((r) => REQUIRED_KEYS.every((k) => (r as any)[k]))
        .map((r) => ({
          id: r.id,
          name: r.name,
          adminEmail: r.email ?? "",
          createdAt: r.created_at,
          iconBg: r.status === "active" ? "success.main" : "primary.main",
        }));

      setOrgs(mapped);
    } catch (err) {
      toast({ title: "Error", description: extractErr(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [debouncedQ]);

  React.useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  /* Create org */
  const onCreateOrg = async (data: { name: string; admins: Array<{ name: string; email: string }> }) => {
    try {
      const res = await axios.post<CreateOrgResponse>("/organizations", {
        name: data.name.trim(),
        admins: data.admins,
      });

      const r = res.data.organization;
      const firstAdmin = res.data.admins?.[0]?.email ?? "";

      setOrgs((prev) => [
        {
          id: r.id,
          name: r.name,
          adminEmail: firstAdmin,
          createdAt: r.created_at,
          iconBg: r.status === "active" ? "success.main" : "primary.main",
        },
        ...prev,
      ]);

      toast({ title: "Organization created", description: r.name });
      onCloseDrawer();
    } catch (err) {
      toast({ title: "Create failed", description: extractErr(err), variant: "destructive" });
    }
  };

  /* Update org */
  const onUpdateOrg = async (patch: Partial<OrgItem>) => {
    if (!(drawer.open && drawer.mode === "details")) return;

    const id = drawer.org.id;

    try {
      const { data } = await axios.patch(`/organizations/${id}`, patch);

      setOrgs((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                name: data.name ?? o.name,
                adminEmail: data.email ?? o.adminEmail,
                iconBg: data.status === "active" ? "success.main" : "primary.main",
              }
            : o
        )
      );

      toast({ title: "Updated", description: "Saved successfully." });
    } catch (err) {
      toast({ title: "Update failed", description: extractErr(err), variant: "destructive" });
    }
  };

  /* ---- Delete Organization ---- */
  const onDeleteOrg = (id: string, name: string) => setConfirmDelete({ open: true, id, name });

  const performDelete = async () => {
    try {
      await axios.delete(`/organizations/${confirmDelete.id}`);

      setOrgs((prev) => prev.filter((o) => o.id !== confirmDelete.id));

      toast({ title: "Organization deleted", description: confirmDelete.name });

      setConfirmDelete({ open: false, id: "", name: "" });
      onCloseDrawer();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: extractErr(err),
        variant: "destructive",
      });
    }
  };

  /* ---- Delete Admin User ---- */

  const performDeleteAdmin = async (orgId: string, adminId: string, adminName: string) => {
    try {
      await axios.delete(`/organizations/${orgId}/employees/${adminId}`);

      toast({
        title: "Admin removed",
        description: adminName,
      });

      // close popup
      setConfirmAdminDelete({ open: false, orgId: "", adminId: "", adminName: "" });

      // reload drawer
      if (drawer.open && drawer.mode === "details") {
        setDrawer({
          mode: "details",
          open: true,
          org: drawer.org,
        });
      }
    } catch (err) {
      toast({
        title: "Delete failed",
        description: extractErr(err),
        variant: "destructive",
      });
    }
  };

  /* ---- Drawer helpers ---- */
  const onOpenCreate = () => setDrawer({ mode: "create", open: true });
  const onOpenDetails = (org: OrgItem) => setDrawer({ mode: "details", open: true, org });
  const onCloseDrawer = () => setDrawer({ open: false });

  /* ========================================================= */

  return (
    <>
      {/* ===== SEARCH ROW (no background) ===== */}
      <Box sx={{ maxWidth: "1200px", mx: "auto", mt: 2, px: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            // removed background/glass — kept spacing only
            p: 0,
            // ensure the search row does not inherit visual background
            background: "transparent",
            borderRadius: 1,
          }}
        >
          <Box sx={{ position: "relative", width: 360 }}>
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2" />
            <TextField
              size="small"
              fullWidth
              placeholder="Search organization"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              InputProps={{ className: "pl-8" }}
            />
          </Box>

          {/* New organization button placed inside the search row */}
          <Box sx={{ ml: "auto" }}>
            <Button onClick={onOpenCreate} className="theme-button" variant="contained" startIcon={<FiPlus />}>
              New organization
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ===== ORG GRID ===== */}
      <Box
        sx={{
          maxWidth: "1200px",
          mx: "auto",
          py: 3,
          px: 2,
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
        }}
      >
        {loading && <div>Loading…</div>}

        {!loading &&
          orgs.map((org) => (
            <OrganizationCard key={org.id} org={org} onClick={() => onOpenDetails(org)} />
          ))}

        {!loading && orgs.length === 0 && <div className="text-gray-500">No organizations found.</div>}
      </Box>

      {/* ===== DRAWER ===== */}
      {drawer.open && drawer.mode === "create" && <OrgDrawer open mode="create" onClose={onCloseDrawer} onCreate={onCreateOrg} />}

      {drawer.open && drawer.mode === "details" && (
        <OrgDrawer
          open
          mode="details"
          org={drawer.org}
          onClose={onCloseDrawer}
          onUpdate={onUpdateOrg}
          onDeleteOrg={(id: string, name: string) => onDeleteOrg(id, name)}
          onDeleteAdmin={(orgId, adminId, adminName) => performDeleteAdmin(orgId, adminId, adminName)}
          onInviteAdmins={handleInviteAdmins}
        />
      )}

      {/* ===== ORG DELETE POPUP ===== */}
      {confirmDelete.open && (
        <Dialog open={true} onClose={() => setConfirmDelete({ open: false, id: "", name: "" })}>
          <DialogTitle>Delete organization?</DialogTitle>

          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Are you sure you want to delete <b>{confirmDelete.name}</b>?
              <br />
              This action cannot be undone.
            </Typography>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setConfirmDelete({ open: false, id: "", name: "" })}>Cancel</Button>

            <Button color="error" variant="contained" onClick={performDelete}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ===== ADMIN DELETE POPUP ===== */}
      {confirmAdminDelete.open && (
        <Dialog
          open={true}
          onClose={() => setConfirmAdminDelete({ open: false, orgId: "", adminId: "", adminName: "" })}
        >
          <DialogTitle>Remove admin user?</DialogTitle>

          <DialogContent>
            <Typography variant="body2">Are you sure you want to remove <b>{confirmAdminDelete.adminName}</b>?</Typography>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={() =>
                setConfirmAdminDelete({
                  open: false,
                  orgId: "",
                  adminId: "",
                  adminName: "",
                })
              }
            >
              Cancel
            </Button>

            <Button
              color="error"
              variant="contained"
              onClick={() =>
                performDeleteAdmin(confirmAdminDelete.orgId, confirmAdminDelete.adminId, confirmAdminDelete.adminName)
              }
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
   </>
  );
}
