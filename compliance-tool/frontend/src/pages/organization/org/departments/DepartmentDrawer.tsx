// src/pages/organization/org/departments/DepartmentDrawer.tsx
import * as React from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  TextField,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { FiX, FiSave, FiTrash2 } from "react-icons/fi";
import type { GridRowId } from "@mui/x-data-grid/models";

export type Department = {
  id: string;
  organization_id: string;
  name: string;
  department_code?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  open: boolean;
  editing: Department | null;
  onClose: () => void;

  /**
   * Called when user submits the form.
   * - If `editing` is provided, this is an update call.
   * - If `editing` is null, this is a create call.
   * Should return a Promise that resolves when finished (or rejects on error).
   */
  onSubmit: (
    payload: { name: string; department_code?: string | null },
    editing?: Department | null
  ) => Promise<void>;

  /**
   * Optional delete handler for the current editing department.
   * Should return a Promise.
   */
  onDelete?: (id: GridRowId) => Promise<void>;
};

export default function DepartmentDrawer({ open, editing, onClose, onSubmit, onDelete }: Props) {
  // local form state (controlled so we can disable easily)
  const [name, setName] = React.useState<string>(editing?.name ?? "");
  const [departmentCode, setDepartmentCode] = React.useState<string>(editing?.department_code ?? "");

  // processing flags
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  // unsaved changes modal
  const [unsavedConfirmOpen, setUnsavedConfirmOpen] = React.useState(false);

  // compute dirty — any change from initial editing values
  const [initialSnapshot, setInitialSnapshot] = React.useState({
    name: editing?.name ?? "",
    department_code: editing?.department_code ?? "",
  });

  const dirty = React.useMemo(() => {
    return (
      (name ?? "") !== (initialSnapshot.name ?? "") ||
      (departmentCode ?? "") !== (initialSnapshot.department_code ?? "")
    );
  }, [name, departmentCode, initialSnapshot]);

  // reset form when opening / editing changes
    React.useEffect(() => {
    if (!open) return;

    const snap = {
        name: editing?.name ?? "",
        department_code: editing?.department_code ?? "",
    };

    setName(snap.name);
    setDepartmentCode(snap.department_code);

    setInitialSnapshot(snap);   // <-- add this line

    setSaving(false);
    setDeleting(false);
    setUnsavedConfirmOpen(false);
    }, [open, editing]);

  const anyProcessing = saving || deleting;

  // close attempt handler (intercept and show unsaved dialog if dirty)
  const attemptClose = () => {
    if (anyProcessing) return; // block while processing
    if (!dirty) {
      onClose();
      return;
    }
    // show confirmation modal offering options
    setUnsavedConfirmOpen(true);
  };

  const handleSaveKeep = async () => {
    // Save and keep the drawer open. Keep dialog open while saving.
    setSaving(true);
    try {
      await onSubmit(
        {
          name: name.trim(),
          department_code: departmentCode?.trim() || null,
        },
        editing ?? null
      );

      setInitialSnapshot({
        name: name.trim(),
        department_code: departmentCode?.trim() || "",
        });

      setUnsavedConfirmOpen(false);
      // keep the values as they are (drawer remains open)
    } catch (err) {
      // swallow — parent should show toast
    } finally {
      setSaving(false);
    }
  };

  const handleCloseWithout = () => {
    // discard changes and close
    // reset fields to initial snapshot to avoid a flicker if parent reopens
    setName(initialSnapshot.name ?? "");
    setDepartmentCode(initialSnapshot.department_code ?? "");
    setUnsavedConfirmOpen(false);
    onClose();
  };

  const handleCancelUnsaved = () => {
    setUnsavedConfirmOpen(false);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!name.trim()) return; // basic client validation

    setSaving(true);
    try {
      await onSubmit(
        {
          name: name.trim(),
          department_code: departmentCode?.trim() || null,
        },
        editing ?? null
      );
    setInitialSnapshot({
    name: name.trim(),
    department_code: departmentCode?.trim() || "",
    });

    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!editing?.id || !onDelete) {
      setDeleteConfirmOpen(false);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(editing.id);
      // parent likely closes the drawer and refreshes; do not attempt to call onClose here —
      // parent handler can close drawer on success. But if parent doesn't close, we can call onClose here:
      // we'll call onClose() to be safe after delete success:
      onClose();
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => {
          attemptClose();
        }}
        keepMounted
        PaperProps={{ sx: { zIndex: 1200 } }}
        // Prevent closing via backdrop when processing — handled in attemptClose
      >
        <Box sx={{ width: { xs: 360, sm: 440 }, p: 3 }}>
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18 }}>
              {editing ? "Edit department" : "Add department"}
            </Typography>
            <IconButton
              size="small"
              onClick={() => {
                attemptClose();
              }}
              disabled={anyProcessing}
            >
              <FiX />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Basic details
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 1.2 }}>
                  <TextField
                    name="name"
                    label="Name"
                    fullWidth
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    margin="dense"
                    size="small"
                    disabled={anyProcessing}
                  />

                  <TextField
                    name="department_code"
                    label="Code"
                    fullWidth
                    value={departmentCode}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-generated. Cannot be edited."
                    margin="dense"
                    size="small"
                    disabled
                  />
                </Stack>
              </Box>

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  type="button"
                  variant="text"
                  onClick={() => {
                    attemptClose();
                  }}
                  disabled={anyProcessing}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<FiSave />}
                  sx={{ ml: "auto" }}
                  disabled={anyProcessing}
                >
                  {saving ? (editing ? "Saving…" : "Creating…") : editing ? "Save changes" : "Save department"}
                </Button>
              </Box>

              {editing && onDelete && (
                <Box sx={{ mt: 1 }}>
                  <Divider sx={{ mb: 1 }} />
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<FiTrash2 />}
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={anyProcessing}
                  >
                    Delete department
                  </Button>
                </Box>
              )}
            </Stack>
          </form>
        </Box>
      </Drawer>

      {/* delete confirm dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => { if (deleting) return; setDeleteConfirmOpen(false); }} disableEscapeKeyDown={deleting}>
        <DialogTitle>Delete department</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action <b>cannot</b> be undone. Are you sure you want to delete <b>{editing?.name}</b>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unsaved changes confirm dialog */}
      <Dialog
        open={unsavedConfirmOpen}
        onClose={() => {
          if (saving || deleting) return;
          handleCancelUnsaved();
        }}
        disableEscapeKeyDown={saving || deleting}
      >
        <DialogTitle>Unsaved changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. What would you like to do?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelUnsaved} disabled={saving || deleting}>
            Cancel
          </Button>

          <Button
            onClick={handleCloseWithout}
            disabled={saving || deleting}
            variant="outlined"
          >
            Close without saving
          </Button>

          <Button
            onClick={handleSaveKeep}
            variant="contained"
            disabled={saving || deleting}
          >
            {saving ? "Saving…" : "Save & keep open"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
