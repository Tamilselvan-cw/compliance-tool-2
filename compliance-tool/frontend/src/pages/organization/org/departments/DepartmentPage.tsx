// src/pages/organization/org/departments/DepartmentPage.tsx
import * as React from "react";
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import {
  DataGrid,
  GridToolbarContainer,
} from "@mui/x-data-grid";

import type {
  GridColDef,
  GridPaginationModel,
  GridSortModel,
  GridRowId,
} from "@mui/x-data-grid/models";

import { FiPlus, FiEdit3, FiTrash2 } from "react-icons/fi";
import { useParams } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import { toast } from "../../../../components/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import DepartmentDrawer from "./DepartmentDrawer";

/* ------------ Types ------------ */

type Department = {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  department_code?: string | null;
  created_at?: string;
  updated_at?: string;
};

type DepartmentListResp = {
  items: Department[];
  total: number;
};

/* ------------ API ------------ */

async function fetchDepartments(
  orgId: string,
  page: number,
  pageSize: number,
  search?: string,
  filterCode?: "all" | "with" | "without",
  sortField?: string,
  sortDir?: "asc" | "desc"
): Promise<DepartmentListResp> {
  const params: Record<string, any> = {
    page: page + 1,
    page_size: pageSize,
  };
  if (search) params.search = search;
  if (filterCode && filterCode !== "all") params.has_code = filterCode === "with" ? true : false;
  if (sortField) {
    params.sort_by = sortField;
    params.sort_dir = sortDir ?? "asc";
  }

  const { data } = await axios.get(`/organizations/${orgId}/departments`, {
    params,
    headers: { Accept: "application/json" },
  });

  return {
    items: data.items || [],
    total: data.total || 0,
  };
}


/* ------------ Page ------------ */

export default function DepartmentPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const storageKey = `org-${orgId ?? "unknown"}-departments-grid`;

  // pagination remembered across tab switches
  const [pagination, setPagination] = React.useState<GridPaginationModel>(() => {
    if (typeof window === "undefined") {
      return { page: 0, pageSize: 10 };
    }
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.page === "number" && typeof parsed.pageSize === "number") {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return { page: 0, pageSize: 10 };
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(pagination));
    } catch {
      // ignore
    }
  }, [pagination, storageKey]);

  const [search, setSearch] = React.useState<string | undefined>(undefined);

  const resolveOrg = () => {
    if (!orgId) throw new Error("Missing orgId in URL");
    return orgId;
  };

  // drawer state (same pattern as UsersPage)
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Department | null>(null);

  // delete confirm dialog (single)
  const [confirm, setConfirm] = React.useState<{ open: boolean; id?: string; name?: string }>({ open: false });

  // bulk selection & bulk delete dialog 
  // const [selectionModel, setSelectionModel] = React.useState<GridRowId[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  // filter for department_code
  const [filterCode, setFilterCode] = React.useState<"all" | "with" | "without">("all");

  // server sort model
  const [sortModel, setSortModel] = React.useState<GridSortModel>([]);

  // loading state derived for disabling UI during operations
  const anyProcessing = bulkDeleting; // currently only bulk delete requires full disable; extend in future

  const extractErr = (e: any) => e?.response?.data?.detail || e?.message || "Something went wrong";

  const [selectionModel, setSelectionModel] = React.useState<GridRowId[]>([]);

  /* ---------- React Query (soft loading + cache) ---------- */

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<DepartmentListResp>({
    queryKey: [
      "org-departments",
      orgId,
      pagination.page,
      pagination.pageSize,
      search ?? "",
      filterCode,
      sortModel?.[0]?.field ?? "",
      sortModel?.[0]?.sort ?? "",
    ],
    queryFn: () =>
      fetchDepartments(
        resolveOrg(),
        pagination.page,
        pagination.pageSize,
        search,
        filterCode,
        sortModel?.[0]?.field,
        sortModel?.[0]?.sort as "asc" | "desc" | undefined
      ),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 min cache
    refetchOnWindowFocus: false,
  });

  // soft reload listener (from AdminShell)
  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ orgId?: string }>;
      if (!orgId || custom.detail?.orgId !== orgId) return;
      refetch();
    };

    window.addEventListener("org-soft-reload", handler as EventListener);
    return () => {
      window.removeEventListener("org-soft-reload", handler as EventListener);
    };
  }, [orgId, refetch]);

    // local controlled search input (separate from the debounced `search` used by the query)
  const [searchInput, setSearchInput] = React.useState<string>("");
  const SEARCH_DEBOUNCE_MS = 400;

  // debounce and push to `search` which is used in the react-query key
  React.useEffect(() => {
    const t = setTimeout(() => {
      const v = searchInput.trim();
      setSearch(v || undefined);
      // reset to first page whenever search changes
      setPagination((p) => ({ ...p, page: 0 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  // keep MUI's own table skeleton
  const gridLoading = isLoading && !data;

  /* ---------- Delete handlers (single) ---------- */

  const openConfirm = (row: Department) => setConfirm({ open: true, id: row.id, name: row.name });
  const closeConfirm = () => setConfirm({ open: false });

  const onConfirmDelete = async () => {
    if (!confirm.id || !orgId) return;
    const id = confirm.id;
    closeConfirm();
    try {
      await axios.delete(`/organizations/${orgId}/departments/${id}`);
      toast({ title: "Department deleted" });
      await refetch();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: extractErr(err),
        variant: "destructive" as any,
      });
    }
  };

  /* ---------- Bulk delete ---------- */

  const openBulkConfirm = () => {
    if (!selectionModel || selectionModel.length === 0) return;
    setBulkConfirmOpen(true);
  };

  const closeBulkConfirm = () => setBulkConfirmOpen(false);

  const performBulkDelete = async () => {
    if (!orgId || selectionModel.length === 0) return;
    setBulkDeleting(true);

    // disable UI via anyProcessing
    const ids = selectionModel.map(String);

    try {
      // Use the server bulk endpoint
      await axios.post(`/organizations/${orgId}/departments/bulk`, { ids });

      toast({
        title: "Departments deleted",
        description: `${ids.length} department(s) removed.`,
      });

      // Clear selection and refresh
      setSelectionModel([]);
      await refetch();
    } catch (err: any) {
      toast({
        title: "Bulk delete failed",
        description: extractErr(err),
        variant: "destructive" as any,
      });
    } finally {
      setBulkDeleting(false);
      setBulkConfirmOpen(false);
    }
  };

  /* ---------- columns ---------- */

  const onEdit = (row: Department) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const columns = React.useMemo<GridColDef<Department>[]>(() => [
    {
      field: "department_code",
      headerName: "Code",
      width: 120,
      sortable: true,
      renderCell: ({ row }) => (
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>
          {row.department_code ?? "—"}
        </Typography>
      ),
    },
    {
      field: "name",
      headerName: "Department",
      flex: 1.2,
      minWidth: 200,
      renderCell: ({ row }) => (
        <Typography
          sx={{
            border: "none",
            background: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            fontWeight: 600,
            fontSize: 14,
            color: "text.primary",
          }}
        >
          {row.name}
        </Typography>
      ),
    },
    {
      field: "_actions",
      headerName: "",
      width: 220, // give room for header actions
      disableColumnMenu: true,
      sortable: false,
      filterable: false,

      /* <-- NEW: renderHeader shows bulk UI when selection exists */
      renderHeader: () => {
        if (!selectionModel || selectionModel.length === 0) {
          // small empty space so column header doesn't collapse visually
          return <Box sx={{ width: "100%", height: 1 }} />;
        }

        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end", // place controls towards right side of the column
              gap: 1,
              pr: 0.5,
              width: "100%",
              // styling to match your theme
              bgcolor: "transparent",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>
              {selectionModel.length} selected
            </Typography>

            <Button
              size="small"
              color="error"
              variant="contained"
              startIcon={<FiTrash2 />}
              onClick={openBulkConfirm}
              disabled={anyProcessing || bulkDeleting}
              sx={{ textTransform: "none", minWidth: 72 }}
            >
              {bulkDeleting ? "Deleting…" : "Delete"}
            </Button>
          </Box>
        );
      },

      renderCell: ({ row }) => (
        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", width: "100%" }}>
          <IconButton size="small" title="Edit" onClick={() => onEdit(row)}>
            <FiEdit3 />
          </IconButton>
          <IconButton size="small" title="Delete" onClick={() => openConfirm(row)}>
            <FiTrash2 />
          </IconButton>
        </Box>
      ),
    },
  ], [
    /* include deps used inside renderHeader to keep it reactive */
    selectionModel,
    anyProcessing,
    bulkDeleting,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  /* ---------- Toolbar (search, filter, bulk actions) ---------- */

  const Toolbar = () => (
    <GridToolbarContainer
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        px: 2,
        py: 1,
        gap: 2,
        flexWrap: "wrap",
        backdropFilter: "blur(10px)",
        background: "rgba(255,255,255,0.18)",
        borderBottom: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "var(--color-text)" }}>
          Search
        </Typography>

        <TextField
          size="small"
          placeholder="Search departments..."
          onChange={(e) => {
            const val = e.target.value?.trim();
            setSearch(val || undefined);
            setPagination((p) => ({ ...p, page: 0 }));
          }}
          sx={{
            "& .MuiInputBase-root": {
              color: "var(--color-text-muted)",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "999px",
              paddingRight: "10px",
            },
            "& .MuiOutlinedInput-notchedOutline": {
              border: "1px solid rgba(255,255,255,0.15)",
            },
          }}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="filter-code-label">Code</InputLabel>
          <Select
            labelId="filter-code-label"
            value={filterCode}
            label="Code"
            onChange={(e: SelectChangeEvent) => {
              setFilterCode(e.target.value as "all" | "with" | "without");
              setPagination((p) => ({ ...p, page: 0 }));
            }}
            sx={{
              background: "rgba(255,255,255,0.12)",
              color: "var(--color-text-muted)",
            }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="with">With code</MenuItem>
            <MenuItem value="without">Without code</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {selectionModel.length > 0 && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {selectionModel.length} selected
            </Typography>

            <Button
              color="error"
              variant="contained"
              size="small"
              startIcon={<FiTrash2 />}
              onClick={openBulkConfirm}
              disabled={anyProcessing}
            >
              {bulkDeleting ? "Deleting…" : "Delete selected"}
            </Button>
          </Box>
        )}
      </Box>
    </GridToolbarContainer>
  );

  return (
    <Box className="w-full" sx={{ width: "100%" }}>
      {/* Header Bar */}
      <Box className="glass-card rounded-2xl p-3 mb-3 flex items-center justify-between w-full">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Departments
        </Typography>
        <Button
          className="theme-button"
          size="small"
          onClick={() => {
            setEditing(null);
            setDrawerOpen(true);
          }}
        >
          <FiPlus style={{ marginRight: 8 }} /> Add Department
        </Button>
      </Box>

      {/* Grid */}

            {/* Search bar (debounced) */}
      <Box sx={{ mb: 2, display: "flex", gap: 2, alignItems: "center", width: "100%" }}>
        <TextField
          size="small"
          placeholder="Search departments..."
          fullWidth
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          disabled={anyProcessing}
          sx={{
            "& .MuiInputBase-root": {
              color: "var(--color-text-muted)",
              background: "rgba(255,255,255,0.12)",
              borderRadius: 2,
              paddingRight: "10px",
            },
            "& .MuiOutlinedInput-notchedOutline": {
              border: "1px solid rgba(255,255,255,0.12)",
            },
          }}
        />

        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setSearchInput("");
            setSearch(undefined);
            setPagination((p) => ({ ...p, page: 0 }));
          }}
          disabled={anyProcessing || !searchInput}
        >
          Clear
        </Button>
      </Box>

      {/* Grid */}
      <Box
        className="glass rounded-2xl w-full"
        sx={{ p: 0, minHeight: 360, width: "100%", position: "relative" }} // <-- position: relative
      >
        {/* Floating bulk-action bar (shows when rows selected) */}
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          loading={gridLoading || (isFetching && !gridLoading)}
          autoHeight
          checkboxSelection
          disableRowSelectionOnClick={false}
          pagination
          paginationMode="server"
          rowCount={total}
          pageSizeOptions={[5, 10, 20, 50]}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          slots={{ toolbar: Toolbar }}
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={(m) => {
            setSortModel(m);
            setPagination((p) => ({ ...p, page: 0 }));
          }}
          onRowSelectionModelChange={(newModel) => {
            const normalise = (m: any): GridRowId[] => {
              if (!m) return [];
              if (Array.isArray(m)) return m;
              if (typeof m === "object") {
                if ("ids" in m) {
                  try { return Array.from((m as any).ids as Iterable<any>); } catch {}
                }
                try { return Array.from(m as Iterable<any>); } catch {}
              }
              return [];
            };
            setSelectionModel(normalise(newModel));
          }}
          sx={{

            width: "100%",
            background: "transparent",
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              background: "rgba(255,255,255,0.25)",
              backdropFilter: "blur(8px)",
              borderBottom: "1px solid rgba(255,255,255,0.18)",
              fontWeight: 600,
              fontSize: "0.9rem",
              color: "var(--color-text)",
              alignItems: "center", // center header content vertically
            },
            "& .MuiDataGrid-columnHeader": {
              // give header cells a bit more height so controls don't feel cramped
              paddingTop: "6px",
              paddingBottom: "6px",
            },
            "& .MuiDataGrid-cell": {
              color: "var(--color-text-muted)",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            },
            "& .MuiDataGrid-row:hover": {
              background: "rgba(255,255,255,0.14)",
            },
            "& .MuiDataGrid-footerContainer": {
              background: "rgba(255,255,255,0.12)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
            },
            // disable pointer events while bulk deleting
            pointerEvents: anyProcessing ? "none" : undefined,
            opacity: anyProcessing ? 0.6 : 1,
          }}
        />
      </Box>

      <DepartmentDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => {
          if (anyProcessing) return; // keep previous safety
          setDrawerOpen(false);
          setEditing(null);
        }}
        onSubmit={async (payload, editingDept) => {
          // this handler is awaited by the drawer — drawer will show saving state while the Promise is unresolved
          try {
            if (editingDept) {
              await axios.patch(`/organizations/${orgId}/departments/${editingDept.id}`, payload);
              toast({ title: "Updated", description: payload.name });
            } else {
              await axios.post(`/organizations/${orgId}/departments`, payload);
              toast({ title: "Added", description: payload.name });
            }

            // IMPORTANT: DO NOT close drawer here (requirement). Keep it open.
            // Refresh data so grid shows latest changes.
            await refetch();
          } catch (err: any) {
            toast({
              title: editingDept ? "Update failed" : "Create failed",
              description: err?.response?.data?.detail || err?.message,
              variant: "destructive" as any,
            });
            // rethrow if you want drawer to know about failure (not required)
            throw err;
          }
        }}
        onDelete={async (id) => {
          try {
            await axios.delete(`/organizations/${orgId}/departments/${id}`);
            toast({ title: "Deleted", description: editing?.name });
            // close drawer after successful delete (since the entity no longer exists)
            setDrawerOpen(false);
            setEditing(null);
            await refetch();
          } catch (err: any) {
            toast({
              title: "Delete failed",
              description: err?.response?.data?.detail || err?.message,
              variant: "destructive" as any,
            });
            throw err;
          }
        }}
      />


      {/* Confirm Delete (single) */}
      <Dialog open={confirm.open} onClose={closeConfirm} disableEscapeKeyDown={anyProcessing}>
        <DialogTitle>Delete department?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove <strong>{confirm.name}</strong>. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm} disabled={anyProcessing}>Cancel</Button>
          <Button onClick={onConfirmDelete} color="error" variant="contained" disabled={anyProcessing}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Bulk Delete */}
      <Dialog open={bulkConfirmOpen} onClose={closeBulkConfirm} disableEscapeKeyDown={bulkDeleting}>
        <DialogTitle>Delete selected departments?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove <strong>{selectionModel.length}</strong> selected department(s). This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBulkConfirm} disabled={bulkDeleting}>Cancel</Button>
          <Button
            onClick={performBulkDelete}
            color="error"
            variant="contained"
            disabled={bulkDeleting}
          >
            {bulkDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
