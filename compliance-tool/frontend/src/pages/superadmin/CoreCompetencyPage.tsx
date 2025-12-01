import * as React from "react";
import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid/models";
import { FiPlus, FiUpload, FiX, FiTrash2, FiEdit2 } from "react-icons/fi";
import { toast } from "../../components/hooks/use-toast";
import axios from "@/api/axiosInstance";
import { useNavigate } from "react-router-dom";

type CoreCompetency = {
  id: string;
  name: string;
  description?: string | null;
  category: "technical" | "functional" | "behavioral";
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
  scope?: string;
};

type CoreCompetencyListResponse = {
  items: CoreCompetency[];
  total: number;
  page: number;
  limit: number;
};

const CATEGORY_OPTIONS = ["technical", "functional", "behavioral"];

function CoreCompetencyToolbar({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <GridToolbarContainer sx={{ p: 1, justifyContent: "space-between" }}>
      <Box sx={{ width: { xs: "100%", sm: 300 } }}></Box>
      <GridToolbarQuickFilter />
      <Stack direction="row" spacing={1}>
        {/* Add button */}
        <Button variant="contained" size="small" startIcon={<FiPlus />} onClick={onAdd}>
          Add Core Competency
        </Button>
      </Stack>
    </GridToolbarContainer>
  );
}

export default function CoreCompetencyPage() {
  const navigate = useNavigate();

  const [rows, setRows] = React.useState<CoreCompetency[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<
    "technical" | "functional" | "behavioral"
  >("technical");

  const [saving, setSaving] = React.useState(false);

  // ---------- load data (use competency API with scope=core, only_active=true) ----------
  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<CoreCompetencyListResponse>(
        `/competencys/competencys`,
        {
          params: {
            page: 1,
            limit: 200,
            scope: "core", // request core scope explicitly
            only_active: true, // prefer server-side filtering when available
          },
        }
      );

      // defensive client-side filter: display only active items
      const items = (res.data.items ?? []).filter((it) => !!it.is_active);
      setRows(items);
    } catch (err: any) {
      toast({
        title: "Failed to load core competencies",
        description: err?.response?.data?.detail || err?.message || "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditId(null);
    setName("");
    setDescription("");
    setCategory("technical");
    setDrawerOpen(true);
  };

  const handleOpenEdit = (row: CoreCompetency) => {
    setEditId(row.id);
    setName(row.name);
    setDescription(row.description || "");
    setCategory(row.category);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    if (!saving) setDrawerOpen(false);
  };

  // ---------- save (create / update) ----------
  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Name is required",
        description: "Please enter a core competency name",
        variant: "destructive",
      });
      return;
    }
    if (!category) {
      toast({
        title: "Category is required",
        description: "Choose technical, functional, or behavioral",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category: category,
        scope: "core", // ensure server treats this as a core competency
      };

      if (editId) {
        // update existing competency
        await axios.patch(
          `/competencys/competencys/${encodeURIComponent(editId)}`,
          payload
        );
        toast({
          title: "Updated successfully",
          description: `"${name}" has been updated.`,
        });
      } else {
        // create new core competency
        await axios.post(`/competencys/competencys`, payload);
        toast({
          title: "Created successfully",
          description: `"${name}" has been added.`,
        });
      }

      setDrawerOpen(false);
      // refresh list
      await loadData();
    } catch (err: any) {
      // Prefer server message
      const serverMsg = err?.response?.data?.detail || err?.response?.data || err?.message;
      toast({
        title: "Failed to save",
        description: serverMsg || "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ---------- delete ----------
  const handleDelete = async (row: CoreCompetency) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${row.name}"?`
    );
    if (!confirmed) return;

    try {
      // delete via competency API (soft delete by default)
      await axios.delete(
        `/competencys/competencys/${encodeURIComponent(row.id)}`,
        {
          params: { soft: true },
        }
      );
      toast({
        title: "Deleted",
        description: `"${row.name}" has been deleted.`,
      });
      await loadData();
    } catch (err: any) {
      const serverMsg = err?.response?.data?.detail || err?.message;
      toast({
        title: "Failed to delete",
        description: serverMsg || "Unexpected error",
        variant: "destructive",
      });
    }
  };

  const columns: GridColDef[] = [
    { field: "name", headerName: "Name", flex: 1, minWidth: 200 },
    {
      field: "category",
      headerName: "Category",
      width: 140,
      renderCell: (params) => (
        <Chip size="small" label={params.value} color="primary" variant="outlined" />
      ),
    },
    {
      field: "description",
      headerName: "Description",
      flex: 2,
      minWidth: 260,
      renderCell: (params) =>
        params.value ? (
          <Typography variant="body2" noWrap>
            {params.value}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 130,
      renderCell: (params) => {
        const row = params.row as CoreCompetency;
        return (
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={() => handleOpenEdit(row)}>
              <FiEdit2 />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
              <FiTrash2 />
            </IconButton>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Core Competencies
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage global core competencies (Technical / Functional / Behavioral)
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            className="theme-button"
            sx={{ textTransform: "none", px: 2, py: 1, fontWeight: 700 }}
            startIcon={<FiPlus />}
            onClick={handleOpenCreate}
          >
            Add Core Competency
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 1 }} />}

      <Box sx={{ flex: 1 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          density="compact"
          sx={{
            "& .MuiDataGrid-columnHeaders": { fontWeight: 600 },
            backgroundColor: "background.paper",
            borderRadius: 2,
          }}
          slots={{
            toolbar: CoreCompetencyToolbar as any,
          }}
          slotProps={{
            toolbar: { onAdd: handleOpenCreate } as any,
          }}
        />
      </Box>

      {/* Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={handleCloseDrawer} PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}>
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {editId ? "Edit Core Competency" : "Add Core Competency"}
              </Typography>
            </Box>
            <IconButton onClick={handleCloseDrawer} disabled={saving}>
              <FiX />
            </IconButton>
          </Stack>

          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              label="Category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as "technical" | "functional" | "behavioral")
              }
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={3} />

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={handleCloseDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={!saving ? <FiUpload /> : undefined}>
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
