// src/components/specific/OrgDrawer.tsx
import * as React from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import {
  FiX,
  FiGrid,
  FiSave,
  FiPlus,
  FiUserPlus,
  FiTrash2,
  FiUser,
} from "react-icons/fi";

import { cn } from "../lib/utils";
import { toast } from "../hooks/use-toast";
import axios from "../../api/axiosInstance";
import type { OrgItem } from "./OrganizationCard";
import { ToastProvider, ToastViewport } from "../ui/toast";

/* ---------------- types ---------------- */
type AdminUser = { id: string; name: string; email: string; createdAt: string };
type DraftAdmin = { name: string; email: string };

type CreatePayload = {
  name: string;
  admins: Array<{ name: string; email: string }>;
};

type Props =
  | {
      open: boolean;
      mode: "create";
      onClose: () => void;
      onCreate: (data: CreatePayload) => Promise<void> | void;
    }
  | {
      open: boolean;
      mode: "details";
      onClose: () => void;
      org: OrgItem;

      onUpdate?: (patch: Partial<OrgItem>) => Promise<void> | void;

      onDeleteOrg?: (id: string, name: string) => Promise<void> | void;

      /* MAIN ONE — Passed from OrganizationsPage */
      onDeleteAdmin?: (
        orgId: string,
        adminId: string,
        adminName: string
      ) => Promise<void> | void;

      onInviteAdmins?: (
        orgId: string,
        admins: Array<{ name: string; email: string }>
      ) => Promise<void> | void;
    };

const MAX_ADMINS = 3;

/* ======================================================= */

export default function OrgDrawer(props: Props) {
  const { open } = props;

  const [name, setName] = React.useState(
    props.mode === "details" ? props.org.name : ""
  );

  // existing admins from API
  const [existingAdmins, setExistingAdmins] = React.useState<AdminUser[]>([]);
  // draft admins to invite
  const [draftAdmins, setDraftAdmins] = React.useState<DraftAdmin[]>([
    { name: "", email: "" },
  ]);

  // loading / processing states
  const [loadingAdmins, setLoadingAdmins] = React.useState(false); // fetching admins
  const [inviting, setInviting] = React.useState(false); // invite request in progress
  const [deletingAdminId, setDeletingAdminId] = React.useState<string | null>(null); // id being deleted
  const [deletingOrgProcessing, setDeletingOrgProcessing] = React.useState(false);
  const [updatingProcessing, setUpdatingProcessing] = React.useState(false);

  /* ------ ADMIN DELETE POPUP ------ */
  const [adminDeletePopup, setAdminDeletePopup] = React.useState({
    open: false,
    adminId: "",
    adminName: "",
  });

  /* Orgn delete */
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  const extractErr = (e: any) =>
    e?.response?.data?.detail?.message ||
    e?.response?.data?.detail ||
    e?.message ||
    "Something went wrong";

  /* ---------------- Load Admins ---------------- */
  const loadAdmins = React.useCallback(async () => {
    if (props.mode !== "details") return;
    setLoadingAdmins(true);
    try {
      const res = await axios.get(`/organizations/${props.org.id}/employees`, {
        params: { page: 1, limit: 200 },
      });

      const raw = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];

      const admins: AdminUser[] = raw
        .filter((e: any) => e.role === "org_admin")
        .map((e: any) => ({
          id: e.id,
          name: e.name || e.full_name || e.email,
          email: e.email,
          createdAt: e.created_at || new Date().toISOString(),
        }));

      setExistingAdmins(admins);
    } catch (err) {
      setExistingAdmins([]);
      console.error("Failed to load admins", err);
    } finally {
      setLoadingAdmins(false);
    }
  }, [props]);

  /* ----------------- Lazy-render admin inputs when visible --------------- */
  const adminListRef = React.useRef<HTMLDivElement | null>(null);
  const [adminsVisible, setAdminsVisible] = React.useState(false);

  React.useEffect(() => {
    // don't lazy while global loading or when there are no admins area (create mode)
    if (loadingAdmins) return;
    if (adminsVisible) return;

    const el = adminListRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setAdminsVisible(true);
      return;
    }

    let cancelled = false;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !cancelled) {
            setAdminsVisible(true);
            obs.disconnect();
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );

    obs.observe(el);

    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [adminsVisible, loadingAdmins]);

  React.useEffect(() => {
    if (!open) return;

    if (props.mode === "details") {
      setName(props.org.name);
      // load admin list (skeleton visible until done)
      loadAdmins();
      // reset admin lazy state (so intersection can trigger again if drawer reopened)
      setAdminsVisible(false);
    } else {
      setName("");
      setExistingAdmins([]);
      setDraftAdmins([{ name: "", email: "" }]);
      setAdminsVisible(false);
    }
  }, [open, props.mode, props, loadAdmins]);

  /* ---------------- DELETE ADMIN ---------------- */
  const confirmAdminDeletion = async () => {
    // Narrow props to the "details" variant before accessing props.org / props.onDeleteAdmin
    if (props.mode !== "details") return;

    const { adminId, adminName } = adminDeletePopup;
    if (!adminId) return;

    setDeletingAdminId(adminId);
    try {
      // If a custom handler was provided, call it; otherwise do the default axios delete
      if (props.onDeleteAdmin) {
        await props.onDeleteAdmin(props.org.id, adminId, adminName);
      } else {
        // default backend call
        await axios.delete(`/organizations/${props.org.id}/employees/${adminId}`);
      }

      /* remove from UI */
      setExistingAdmins((prev) => prev.filter((a) => a.id !== adminId));

      toast({
        title: "Admin removed",
        description: `"${adminName}" removed successfully.`,
      });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: extractErr(err),
        variant: "destructive" as any,
      });
    } finally {
      setDeletingAdminId(null);
      setAdminDeletePopup({ open: false, adminId: "", adminName: "" });
    }
  };

  /* ---------------- derived validation ---------------- */
  const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

  const validDrafts = draftAdmins.filter((a) => isValidEmail(a.email.trim()));
  const hasAnyValid = validDrafts.length > 0;
  const hasInvalidFilled = draftAdmins.some(
    (a) => a.email.trim() && !isValidEmail(a.email.trim())
  );

  /* ---------------- invite admins for existing org ---------------- */

  const canInvite =
    props.mode === "details" &&
    hasAnyValid &&
    !hasInvalidFilled &&
    !inviting &&
    existingAdmins.length + validDrafts.length <= MAX_ADMINS;

  const onInviteClick = async () => {
    if (!canInvite || props.mode !== "details") return;

    const payload = validDrafts.map((a) => ({
      name: a.name.trim() || a.email.trim().split("@")[0],
      email: a.email.trim(),
    }));

    setInviting(true);
    try {
      if (props.onInviteAdmins) {
        await props.onInviteAdmins(props.org.id, payload);
      } else {
        await Promise.all(
          payload.map((a) =>
            axios.post(`/organizations/${props.org.id}/employees`, {
              name: a.name,
              email: a.email,
              role: "org_admin",
            })
          )
        );
      }

      toast({
        title: "Admins invited",
        description: `${payload.length} admin user(s) invited`,
      });

      setDraftAdmins([{ name: "", email: "" }]);
      await loadAdmins();
      // ensure admin inputs will be rendered (in case they were off-screen)
      setAdminsVisible(true);
    } catch (err: any) {
      toast({
        title: "Invite failed",
        description: extractErr(err),
        variant: "destructive" as any,
      });
    } finally {
      setInviting(false);
    }
  };

  /* ---------------- Delete organization ---------------- */
  const performDeleteOrg = async () => {
    if (props.mode !== "details") return;
    setDeletingOrgProcessing(true);
    try {
      if (props.onDeleteOrg) {
        await props.onDeleteOrg(props.org.id, props.org.name);
      } else {
        await axios.delete(`/organizations/${props.org.id}`);
      }
      toast({
        title: "Organization deleted",
        description: props.org.name,
      });
      setDeleteOpen(false);
      props.onClose();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: extractErr(err),
        variant: "destructive" as any,
      });
    } finally {
      setDeletingOrgProcessing(false);
    }
  };

  /* ---------------- Update organization (save) ---------------- */
  const onSave = async () => {
    // simple update: only name for now
    if (props.mode !== "details") return;
    setUpdatingProcessing(true);
    try {
      if (props.onUpdate) {
        await props.onUpdate({ name });
      } else {
        await axios.patch(`/organizations/${props.org.id}`, { name });
      }
      toast({ title: "Updated", description: "Saved successfully." });
    } catch (err) {
      toast({
        title: "Update failed",
        description: extractErr(err),
        variant: "destructive" as any,
      });
    } finally {
      setUpdatingProcessing(false);
    }
  };

  /* ---------------- overall "any processing" flag ---------------- */
  const anyProcessing =
    loadingAdmins ||
    inviting ||
    Boolean(deletingAdminId) ||
    deletingOrgProcessing ||
    updatingProcessing;

  /* ---------------- helpers for disabling UI during processing -------------- */
  const disableWhileProcessing = anyProcessing;

  return (
    <>
      {/* Drawer */}
      <ToastProvider>
        <ToastViewport />
      </ToastProvider>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => {
          if (anyProcessing) return;
          props.onClose();
        }}
        keepMounted
        PaperProps={{ sx: { zIndex: 1100 } }}
        ModalProps={{ sx: { zIndex: 1100 } }}
      >
        <Box
          className={cn("w-[520px] max-w-[95vw] flex flex-col h-full")}
          sx={{ background: "var(--color-surface)" }}
        >
          {/* HEADER */}
          <Box sx={{ p: 2, display: "flex", gap: 2 }}>
            <Avatar
              variant="rounded"
              sx={{
                width: 40,
                height: 40,
                background:
                  "linear-gradient(135deg, var(--logo-blue), var(--logo-green))",
                color: "#fff",
              }}
            >
              <FiGrid />
            </Avatar>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {props.mode === "create"
                  ? "New organization"
                  : "Organization details"}
              </Typography>

              {props.mode === "details" && (
                <Typography variant="caption" sx={{ color: "var(--color-text-2)" }}>
                  ID: {props.org.id}
                </Typography>
              )}
            </Box>

            <IconButton
              onClick={() => {
                if (anyProcessing) return;
                props.onClose();
              }}
              sx={{ marginLeft: "auto" }}
              disabled={anyProcessing}
            >
              <FiX />
            </IconButton>
          </Box>

          <Divider />

          {/* BODY */}
          <Box className="p-4 space-y-4 overflow-auto">
            {/* ORG NAME */}
            <Box className="glass p-2 rounded-lg border border-[var(--color-border)]">
              <TextField
                label="Organization name"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={disableWhileProcessing}
              />

              {/* FOOTER */}
              <Box className="p-4 flex justify-end gap-2">
                <Button
                  variant="text"
                  onClick={() => {
                    if (anyProcessing) return;
                    props.onClose();
                  }}
                  disabled={anyProcessing}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={<FiSave />}
                  onClick={onSave}
                  disabled={disableWhileProcessing || props.mode !== "details"}
                >
                  {updatingProcessing ? "Saving…" : props.mode === "create" ? "Create" : "Save changes"}
                </Button>
              </Box>
            </Box>

            {/* ADMIN LIST */}
            <Box
              ref={adminListRef}
              className="glass rounded-lg border border-[var(--color-border)]"
            >
              <Box className="p-2 flex items-center gap-2">
                <FiUserPlus />
                <Typography sx={{ fontWeight: 600 }}>Admin users</Typography>
              </Box>

              <Divider />

              {/* existing admins area */}
              <Box>
                {loadingAdmins ? (
                  // skeletons while fetching
                  <List dense>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: "grey.200" }}>
                          <FiUser />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Box sx={{ height: 12, width: "40%", bgcolor: "grey.200", borderRadius: 1 }} />}
                        secondary={<Box sx={{ height: 10, width: "60%", bgcolor: "grey.100", borderRadius: 1, mt: 1 }} />}
                      />
                    </ListItem>

                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: "grey.200" }}>
                          <FiUser />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Box sx={{ height: 12, width: "40%", bgcolor: "grey.200", borderRadius: 1 }} />}
                        secondary={<Box sx={{ height: 10, width: "60%", bgcolor: "grey.100", borderRadius: 1, mt: 1 }} />}
                      />
                    </ListItem>
                  </List>
                ) : !adminsVisible ? (
                  // light placeholders until the area scrolls into view
                  <List dense>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: "grey.100" }}>
                          <FiUser />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Box sx={{ height: 12, width: "40%", bgcolor: "grey.100", borderRadius: 1 }} />}
                        secondary={<Box sx={{ height: 10, width: "60%", bgcolor: "grey.50", borderRadius: 1, mt: 1 }} />}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: "grey.100" }}>
                          <FiUser />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Box sx={{ height: 12, width: "40%", bgcolor: "grey.100", borderRadius: 1 }} />}
                        secondary={<Box sx={{ height: 10, width: "60%", bgcolor: "grey.50", borderRadius: 1, mt: 1 }} />}
                      />
                    </ListItem>
                    <Box sx={{ px: 2, pb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Scroll to load admins
                      </Typography>
                    </Box>
                  </List>
                ) : (
                  // actual list (adminsVisible === true && !loadingAdmins)
                  <List dense>
                    {existingAdmins.map((a) => (
                      <ListItem
                        key={a.id}
                        secondaryAction={
                          <IconButton
                            onClick={() =>
                              setAdminDeletePopup({
                                open: true,
                                adminId: a.id,
                                adminName: a.name,
                              })
                            }
                            disabled={disableWhileProcessing}
                          >
                            <FiTrash2 />
                          </IconButton>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar>
                            <FiUser />
                          </Avatar>
                        </ListItemAvatar>

                        <ListItemText primary={a.name} secondary={a.email} />
                      </ListItem>
                    ))}

                    {existingAdmins.length === 0 && (
                      <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          No admin users yet.
                        </Typography>
                      </Box>
                    )}
                  </List>
                )}
              </Box>

              <Divider />

              {/* Draft Admin Rows */}
              <Box className="p-2 grid gap-2">
                {adminsVisible ? (
                  draftAdmins.map((row, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr auto",
                        gap: 2,
                      }}
                    >
                      <TextField
                        label="Name"
                        value={row.name}
                        onChange={(e) =>
                          setDraftAdmins((list) =>
                            list.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                          )
                        }
                        disabled={disableWhileProcessing}
                      />

                      <TextField
                        label="Email"
                        value={row.email}
                        onChange={(e) =>
                          setDraftAdmins((list) =>
                            list.map((r, i) => (i === idx ? { ...r, email: e.target.value } : r))
                          )
                        }
                        disabled={disableWhileProcessing}
                      />

                      <IconButton
                        onClick={() =>
                          setDraftAdmins((list) => list.filter((_, i) => i !== idx))
                        }
                        disabled={disableWhileProcessing}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </Box>
                  ))
                ) : (
                  // not visible yet: show a simple Add row so user can still add quickly
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Add admins will appear once you scroll here.
                    </Typography>
                  </Box>
                )}

                {existingAdmins.length + draftAdmins.length < MAX_ADMINS && (
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<FiPlus />}
                      onClick={() =>
                        setDraftAdmins((list) => [...list, { name: "", email: "" }])
                      }
                      disabled={disableWhileProcessing}
                    >
                      Add
                    </Button>
                  </Box>
                )}

                {/* Invite button – for edit mode */}
                {props.mode === "details" && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-start",
                      mt: 1.5,
                    }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      onClick={onInviteClick}
                      disabled={!canInvite || disableWhileProcessing}
                      sx={{ textTransform: "none", fontWeight: 600 }}
                    >
                      {inviting ? "Inviting…" : "Invite users"}
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>

            {/* DANGER ZONE */}
            {props.mode === "details" && (
              <Box className="glass p-2 rounded-lg border border-[var(--color-border)]">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Danger zone
                </Typography>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  Delete <b>{props.org.name}</b> permanently.
                </Typography>

                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<FiTrash2 />}
                  onClick={() => setDeleteOpen(true)}
                  disabled={anyProcessing}
                >
                  Delete organization
                </Button>
              </Box>
            )}
          </Box>

          <Divider />
        </Box>
      </Drawer>

      {/* ======================================================= */}
      {/* =============== ADMIN DELETE POPUP ==================== */}
      {/* ======================================================= */}

      <Dialog
        open={adminDeletePopup.open}
        onClose={() => {
          // prevent closing while delete is processing
          if (deletingAdminId) return;
          setAdminDeletePopup({ open: false, adminId: "", adminName: "" });
        }}
        disableEscapeKeyDown={Boolean(deletingAdminId)}
        // disable backdrop click by ignoring onClose while deletingAdminId is set
      >
        <DialogTitle>Remove admin user?</DialogTitle>

        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to remove <b>{adminDeletePopup.adminName}</b>?
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              if (deletingAdminId) return;
              setAdminDeletePopup({ open: false, adminId: "", adminName: "" });
            }}
            disabled={Boolean(deletingAdminId)}
          >
            Cancel
          </Button>

          <Button
            color="error"
            variant="contained"
            onClick={confirmAdminDeletion}
            disabled={Boolean(deletingAdminId)}
          >
            {deletingAdminId ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================= */}
      {/* ============== ORGANIZATION DELETE POPUP ============== */}
      {/* ======================================================= */}

      {props.mode === "details" && (
        <Dialog
          open={deleteOpen}
          onClose={() => {
            if (deletingOrgProcessing) return;
            setDeleteOpen(false);
          }}
          disableEscapeKeyDown={deletingOrgProcessing}
        >
          <DialogTitle>Delete organization</DialogTitle>

          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              This action <b>cannot</b> be undone. Type organization name:
            </Typography>

            <Box
              sx={{
                px: 1,
                py: 0.75,
                mb: 1,
                bgcolor: "rgba(0,0,0,0.04)",
                borderRadius: 1,
              }}
            >
              {props.org.name}
            </Box>

            <TextField
              fullWidth
              size="small"
              placeholder="Type name to confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={deletingOrgProcessing}
            />
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)} disabled={deletingOrgProcessing}>
              Cancel
            </Button>

            <Button
              color="error"
              variant="contained"
              disabled={deleteConfirmText !== props.org.name || deletingOrgProcessing}
              onClick={performDeleteOrg}
            >
              {deletingOrgProcessing ? "Deleting…" : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
