// src/pages/organization/org/RolesPage.tsx
import * as React from "react";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from "@mui/material";
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid/models";
import {
  FiPlus,
  FiX,
  FiTrash2,
  FiEdit2,
} from "react-icons/fi";
import { toast } from "../../../../components/hooks/use-toast";
import { cn } from "../../../../components/lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "@/api/axiosInstance";

type Department = {
  id: string;
  name: string;
  department_code?: string | null; // optional — API may return this if available
};


type RoleOut = {
  id: string;
  organization_id: string;
  title: string;
  descriptions: string[];
  experience_years?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  department_id: string;
  role_code?: string | null; // <-- added
};

type RolesListResp = {
  items: RoleOut[];
  total: number;
  page: number;
  limit: number;
};

type RoleCreateIn = {
  title: string;
  job_descriptions: string[];
  experience_years?: number | null;
  department_id: string;
};

type RoleUpdateIn = Partial<RoleCreateIn>;


type RolesPageQuery = {
  roles: RoleOut[];
  departments: Department[];
};

const textFieldSx = {
  "& .MuiInputBase-root": {
    borderRadius: 2,
  },
  "& .MuiInputBase-input": {
    fontSize: 14,
  },
  "& .MuiInputLabel-root": {
    fontSize: 13,
  },
} as const;

async function fetchOrgRolesPage(orgId: string): Promise<RolesPageQuery> {
  const [rolesRes, depsRes] = await Promise.all([
    axios.get<RolesListResp>(`/organizations/${orgId}/roles`, {
      params: { page: 1, limit: 200 },
    }),
    axios.get<{ items: Department[] }>(
      `/organizations/${orgId}/departments`,
      { params: { page: 1, limit: 500 } }
    ),
  ]);

  const roles = rolesRes.data?.items ?? [];
  const departments = depsRes.data?.items ?? [];

  return { roles, departments };
}

export default function RolesPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const resolveOrg = () => {
    if (!orgId) throw new Error("organization_id missing in URL");
    return orgId;
  };

  const storageKey = `org-${orgId ?? "unknown"}-roles-grid`;

  const [pagination, setPagination] = React.useState<GridPaginationModel>(() => {
    if (typeof window === "undefined") return { page: 0, pageSize: 10 };
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.page === "number" &&
          typeof parsed.pageSize === "number"
        ) {
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

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<RolesPageQuery>({
    queryKey: ["org-roles", orgId],
    queryFn: () => fetchOrgRolesPage(orgId as string),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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

  const allRows = data?.roles ?? [];
  const departments = data?.departments ?? [];

  // build quick lookup maps
  const departmentsMap = React.useMemo(() => {
    const m = new Map<string, Department>();
    for (const d of departments) m.set(d.id, d);
    return m;
  }, [departments]);

  // compute role counts per department from allRows (all roles)
  const deptRoleCountMap = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allRows) {
      const id = r.department_id;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [allRows]);

  const pageRows = React.useMemo(() => {
    const start = pagination.page * pagination.pageSize;
    return allRows.slice(start, start + pagination.pageSize);
  }, [allRows, pagination]);


  // returns department object (or undefined)
  const getDept = React.useCallback(
    (id?: string) => departmentsMap.get(id ?? "") as Department | undefined,
    [departmentsMap]
  );

// For places that previously used deptName(id), use getDept(id)?.name


  const titleRef = React.useRef<HTMLInputElement>(null);
  const [title, setTitle] = React.useState("");
  const [expYrs, setExpYrs] = React.useState<string>("");
  const [jds, setJds] = React.useState<string[]>([""]);
  const [deptId, setDeptId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "edit" | "bulk">("add");
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const [confirm, setConfirm] = React.useState<{
    open: boolean;
    id?: string;
    title?: string;
  }>({ open: false });

  const resetForm = () => {
    setTitle("");
    setExpYrs("");
    setJds([""]);
    setDeptId("");
    setEditingId(null);
    setMode("add");
  };

  const addJdRow = () => setJds((p) => [...p, ""]);
  const changeJd = (idx: number, v: string) =>
    setJds((p) => p.map((x, i) => (i === idx ? v : x)));
  const removeJd = (idx: number) =>
    setJds((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)));

  const apiCreate = async (payload: RoleCreateIn) => {
    const body: any = {
      ...payload,
      job_descriptions: payload.job_descriptions,
    };

    const { data } = await axios.post<RoleOut>(
      `/organizations/${resolveOrg()}/roles`,
      body
    );
    return data;
  };
  const apiUpdate = async (id: string, payload: RoleUpdateIn) => {
    const body: any = {
      ...payload,
      ...(payload.job_descriptions ? { job_descriptions: payload.job_descriptions } : {}),
    };

    const { data } = await axios.patch<RoleOut>(
      `/organizations/${resolveOrg()}/roles/${id}`,
      body
    );
    return data;
  };
  const apiDelete = async (id: string, soft = false) => {
    await axios.delete(`/organizations/${resolveOrg()}/roles/${id}`, {
      params: { soft },
    });
  };


  const columns = React.useMemo<GridColDef<RoleOut>[]>(() => [
    {
      field: "department_id",
      headerName: "Department",
      width: 240,
      renderCell: (p) => {
        const dept = getDept(p.value as string);
        return (
          <Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: 13,
                lineHeight: "16px",
                color: "text.primary",
              }}
            >
              {dept?.name ?? "—"}
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: "block", color: "text.secondary", mt: 0.25 }}
            >
              {dept?.department_code ?? ""}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "title",
      headerName: "Role",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => {
        const row = params.row as RoleOut;
        return (
          <Box>
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
              {params.value}
            </Typography>

            {/* role_code shown as grey caption under title */}
            <Typography
              variant="caption"
              sx={{ display: "block", color: "text.secondary", mt: 0.25 }}
            >
              {row.role_code ?? ""}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "_",
      headerName: "",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <IconButton
            size="small"
            title="Edit role"
            onClick={(e) => {
              e.stopPropagation();
              if (!orgId) return;
              navigate(`/org/${orgId}/organization/roles/${row.id}`);
            }}
          >
            <FiEdit2 />
          </IconButton>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setConfirm({ open: true, id: row.id, title: row.title });
            }}
            title="Delete role"
          >
            <FiTrash2 />
          </IconButton>
        </Box>
      ),
    },
  ], [navigate, orgId, getDept, deptRoleCountMap]);

  const submitInternal = async (goNext: boolean) => {
    const cleaned = jds.map((s) => s.trim()).filter(Boolean);
    if (!title.trim() || !cleaned.length || !deptId) {
      toast({
        title: "Missing fields",
        description:
          "Title, Department and at least one Job Description are required.",
        variant: "destructive" as any,
      });
      return;
    }

    const payload: RoleCreateIn = {
      title: title.trim(),
      job_descriptions: cleaned,
      experience_years: expYrs ? Number(expYrs) : undefined,
      department_id: deptId,
    };

    setSubmitting(true);
    try {
      if (mode === "edit" && editingId) {
        const updated = await apiUpdate(editingId, payload);
        toast({ title: "Role updated", description: updated.title });
        setDrawerOpen(false);
        resetForm();
      } else {
        const created = await apiCreate(payload);
        toast({ title: "Role added", description: created.title });

        if (goNext) {
          setTitle("");
          setExpYrs("");
          setJds([""]);
          setTimeout(() => titleRef.current?.focus(), 0);
        } else {
          setDrawerOpen(false);
          resetForm();
        }
      }

      await refetch();
    } catch (err: any) {
      toast({
        title: mode === "edit" ? "Update failed" : "Create failed",
        description:
          err?.response?.data?.detail || err?.message || "Unknown error",
        variant: "destructive" as any,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirm.id) return;
    try {
      await apiDelete(confirm.id, false);
      toast({ title: "Role deleted", description: confirm.title });
      await refetch();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.response?.data?.detail || err?.message,
        variant: "destructive" as any,
      });
    } finally {
      setConfirm({ open: false });
    }
  };

  const gridLoading = isLoading || (isFetching && !isLoading);

  return (
    <Box sx={{ m: 1.5 }}>
      {/* Toolbar */}
      <Box
        className={cn("glass-card rounded-2xl")}
        sx={{
          borderRadius: "var(--radius)",
          p: 1.25,
          mb: 1.25,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Roles
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small"
            className="theme-button"
            onClick={() => {
              if (!orgId) return;
              navigate(`/org/${orgId}/organization/roles/new`);
            }}
          >
            <FiPlus style={{ marginRight: 8 }} /> Add role
          </Button>
          {/* <Button
            size="small"
            variant="outlined"
            onClick={() => {
              resetForm();
              setMode("bulk");
              setDrawerOpen(true);
            }}
          >
            <FiUpload style={{ marginRight: 8 }} /> Upload bulk
          </Button> */}
        </Box>
      </Box>

      {/* Grid */}
      <Box
        className="glass rounded-2xl"
        sx={{ p: 0, overflow: "hidden", mx: 0.5 }}
      >
        
        <DataGrid
          rows={pageRows}
          columns={columns}
          getRowId={(r) => r.id}
          checkboxSelection
          disableRowSelectionOnClick
          density="compact"
          disableColumnMenu
          pagination
          paginationMode="server"
          rowCount={allRows.length}
          pageSizeOptions={[5, 10, 20, 50]}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          loading={gridLoading}
          onRowClick={(params) => {
            if (!orgId) return;
            const row = params.row as RoleOut;
            navigate(`/org/${orgId}/organization/roles/${row.id}`);
          }}
          sx={{
            "--DataGrid-rowHeight": "100px",   // primary control
            "& .MuiDataGrid-columnHeaders": { minHeight: 48, maxHeight: 48 },
            "& .MuiDataGrid-columnHeader": { px: 0.5 },
            // ensure cell content is vertically centered and has extra padding
            "& .MuiDataGrid-cell": {
              px: 0.5,
              py: "16px",
              display: "flex",
              alignItems: "center",
            },
            "& .MuiDataGrid-virtualScrollerRenderZone": {
              "& .MuiDataGrid-row": { gap: 0 },
            },
            "& .MuiDataGrid-columnSeparator": { display: "none" },
          }}
          slots={{
            toolbar: () => (
              <GridToolbarContainer
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  px: 1,
                  py: 0.5,
                  backdropFilter: "blur(10px)",
                  background: "rgba(255,255,255,0.18)",
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: "var(--color-text)" }}
                >
                  Search
                </Typography>
                <GridToolbarQuickFilter
                  quickFilterParser={(v) => v.split(" ")}
                />
              </GridToolbarContainer>
            ),
          }}
        />

      </Box>

      {/* Add / Edit / Bulk Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
      >
        <Box sx={{ width: { xs: 360, sm: 440 }, p: 3 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18 }}>
              {mode === "add"
                ? "Add role"
                : mode === "edit"
                ? "Edit role"
                : "Bulk upload"}
            </Typography>
            <IconButton size="small" onClick={() => setDrawerOpen(false)}>
              <FiX />
            </IconButton>
          </Box>

          {(mode === "add" || mode === "edit") && (
            <Stack spacing={2.5}>
              {/* BASIC DETAILS */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, textTransform: "uppercase" }}
                >
                  Basic details
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 1.2 }}>
                  <TextField
                    inputRef={titleRef}
                    label="Job title *"
                    fullWidth
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    size="small"
                    sx={textFieldSx}
                    margin="dense"
                  />

                  <TextField
                    select
                    label="Department *"
                    fullWidth
                    required
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    size="small"
                    sx={textFieldSx}
                    margin="dense"
                  >
                    {departments.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label="Experience years (optional)"
                    type="number"
                    inputProps={{ step: "0.1", min: 0 }}
                    fullWidth
                    value={expYrs}
                    onChange={(e) => setExpYrs(e.target.value)}
                    size="small"
                    sx={textFieldSx}
                    margin="dense"
                  />
                </Stack>
              </Box>

              {/* JOB DESCRIPTIONS */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, textTransform: "uppercase" }}
                >
                  Job description
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: "block", color: "text.secondary", mt: 0.3 }}
                >
                  Minimum one description is required.
                </Typography>
                <Stack spacing={1.1} sx={{ mt: 1.1 }}>
                  {jds.map((val, idx) => (
                    <Stack
                      key={idx}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                    >
                      <TextField
                        fullWidth
                        placeholder={`Description ${idx + 1}`}
                        value={val}
                        onChange={(e) => changeJd(idx, e.target.value)}
                        size="small"
                        sx={textFieldSx}
                        margin="dense"
                      />
                      <Button
                        variant="outlined"
                        onClick={() =>
                          idx === jds.length - 1 ? addJdRow() : removeJd(idx)
                        }
                        title={
                          idx === jds.length - 1 ? "Add description" : "Remove"
                        }
                        sx={{ minWidth: 42, fontSize: 18, lineHeight: 1 }}
                      >
                        {idx === jds.length - 1 ? "+" : "–"}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Box>

              {/* ACTIONS */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ mt: 0.5 }}
              >
                <Button
                  variant="contained"
                  className="theme-button"
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    flex: 1,
                    py: 1.05,
                  }}
                  disabled={submitting}
                  onClick={() => submitInternal(false)}
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    flex: 1,
                    py: 1.05,
                  }}
                  disabled={submitting}
                  onClick={() => submitInternal(true)}
                >
                  Save & Next
                </Button>
              </Stack>
            </Stack>
          )}

          {isError && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="error">
                {(error as any)?.message || "Failed to load roles."}
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Confirm Delete */}
      <Dialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
      >
        <DialogTitle>Delete role?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will permanently delete <strong>{confirm.title}</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm({ open: false })}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
