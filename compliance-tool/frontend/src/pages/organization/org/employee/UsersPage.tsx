// ----------------------------------------------
// src/pages/organization/org/UsersPage.tsx
// ----------------------------------------------
import * as React from "react";
import {
  Box,
  Button,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from "@mui/material";

import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid/models";
import { DataGrid } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";

import { FiPlus, FiEdit, FiTrash2 } from "react-icons/fi";
import { cn } from "../../../../components/lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../../../api/axiosInstance";
import { toast } from "../../../../components/hooks/use-toast";

const ROLE_OPTIONS = ["employee", "hr", "admin", "manager"] as const;
export type AppRole = (typeof ROLE_OPTIONS)[number];

type Department = { id: string; name: string };
type JobRole = { id: string; title?: string; name?: string };

export type OrgUser = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: AppRole;
  department?: string;
  org_role?: string;
  org_role_secondary?: string;
  department_id?: string | null;
  primary_role_id?: string | null;
  secondary_role_id?: string | null;
  manager_id?: string | null;
  manager_user_name?: string | null;
  created_at: string;
  employee_number?: string | null;
};

type UsersPageQuery = {
  employees: OrgUser[];
  departments: Department[];
  roles: JobRole[];
};

/* ------------------------------
   Query fetcher (like dashboard)
------------------------------ */
async function fetchOrgUsersPage(orgId: string): Promise<UsersPageQuery> {
  const [empRes, depsRes, rolesRes] = await Promise.all([
    axiosInstance.get(`/organizations/${orgId}/employees`, {
      params: { page: 1, limit: 200 },
    }),
    axiosInstance.get<{ items: Department[] }>(
      `/organizations/${orgId}/departments`,
      { params: { page: 1, limit: 200 } }
    ),
    axiosInstance.get<{ items: JobRole[] }>(`/organizations/${orgId}/roles`, {
      params: { page: 1, limit: 200 },
    }),
  ]);

  const rawList: any[] = Array.isArray(empRes.data)
    ? empRes.data
    : Array.isArray((empRes.data as any)?.items)
    ? (empRes.data as any).items
    : [];

  const employees: OrgUser[] = rawList.map((emp: any) => ({
    id: emp.id,
    organization_id: emp.org_id ?? emp.organization_id,
    name: emp.name,
    email: emp.email,
    role: emp.role,
    department:
      emp.department?.name ?? emp.department_name ?? emp.department ?? "",
    org_role:
      emp.primary_role?.title ?? emp.primary_role_title ?? emp.job_title ?? "",
    org_role_secondary:
      emp.secondary_role?.title ?? emp.secondary_role_title ?? "",

    manager_id: emp.manager_id ?? emp.manager_emp?.id ?? null,
    manager_user_name: emp.manager_emp?.name ?? null,
    employee_number: emp.employee_number ?? null,
    department_id: emp.department_id ?? emp.department?.id ?? null,
    primary_role_id: emp.primary_role_id ?? emp.primary_role?.id ?? null,
    secondary_role_id: emp.secondary_role_id ?? emp.secondary_role?.id ?? null,
    created_at: emp.created_at,
  }));

  const departments =
    (depsRes.data as any)?.items ??
    (Array.isArray(depsRes.data) ? (depsRes.data as any) : []);
  const roles =
    (rolesRes.data as any)?.items ??
    (Array.isArray(rolesRes.data) ? (rolesRes.data as any) : []);

  return { employees, departments, roles };
}

export default function UsersPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const storageKey = `org-${orgId ?? "unknown"}-users-grid`;

  // pagination remembered across tab switches
  const [pagination, setPagination] = React.useState<GridPaginationModel>(() => {
    if (typeof window === "undefined") {
      return { page: 0, pageSize: 10 };
    }
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

  /* ------------------------------
     Data with React Query
  ------------------------------ */
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<UsersPageQuery>({
    queryKey: ["org-users", orgId],
    queryFn: () => fetchOrgUsersPage(orgId as string),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Soft reload listener (from AdminShell)
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

  const allRows = data?.employees ?? [];

  // -------------- current logged-in manager id --------------
  const [currentManagerId, setCurrentManagerId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Adjust these keys to whatever you actually store
      const fromEmployee =
        window.localStorage.getItem("employee_id") ||
        window.localStorage.getItem("emp_id");
      const fromUser = window.localStorage.getItem("user_id");
      setCurrentManagerId(fromEmployee || fromUser || null);
    } catch {
      setCurrentManagerId(null);
    }
  }, []);

  // Filter rows to only show direct reportees of the current logged-in user
  const visibleRows = React.useMemo(() => {
    if (!currentManagerId) {
      // If we don't yet know the current manager id, show all as fallback
      return allRows;
    }
    return allRows.filter((e) => e.manager_id === currentManagerId);
  }, [allRows, currentManagerId]);

  const pageRows = React.useMemo(() => {
    const start = pagination.page * pagination.pageSize;
    return visibleRows.slice(start, start + pagination.pageSize);
  }, [visibleRows, pagination]);

  /* ------------------------------
     Actions + Delete Dialog
  ------------------------------ */
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletingEmployee, setDeletingEmployee] = React.useState<OrgUser | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const openDeleteDialog = (row: OrgUser) => {
    setDeletingEmployee(row);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleteLoading) return; // prevent closing while deleting
    setDeleteDialogOpen(false);
    setDeletingEmployee(null);
  };

  const handleDeleteConfirm = async () => {
    if (!orgId || !deletingEmployee) return;
    setDeleteLoading(true);
    try {
      await axiosInstance.delete(
        `/organizations/${orgId}/employees/${deletingEmployee.id}`
      );
      toast({
        title: "Employee deleted",
        description: `${deletingEmployee.name} was removed.`,
      });
      setDeleteDialogOpen(false);
      setDeletingEmployee(null);
      // refresh data
      await refetch();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description:
          err?.response?.data?.detail ||
          err?.message ||
          "Could not delete employee.",
        variant: "destructive" as any,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ------------------------------
     Actions
  ------------------------------ */
  const onRowClick = (row: OrgUser) => {
    if (!orgId) return;
    navigate(`/org/${orgId}/organization/users/${row.id}`);
  };

  const onEditClick = (row: OrgUser) => {
    if (!orgId) return;
    navigate(`/org/${orgId}/organization/users/${row.id}/edit`);
  };

  const gridLoading = isLoading && !data;

  // columns including Primary Role, Secondary Role, Reporting To, Actions
  const columns = React.useMemo<GridColDef<OrgUser>[]>(
    () => [
      {
        field: "employee_number",
        headerName: "Employee #",
        width: 140,
      },
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        minWidth: 160,
        renderCell: (params) => (
          <Typography
            onClick={() => onRowClick(params.row)}
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
        ),
      },

      {
        field: "org_role",
        headerName: "Primary Role",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "org_role_secondary",
        headerName: "Secondary Role",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "department",
        headerName: "Department",
        flex: 1,
        minWidth: 160,
      },
      {
        field: "manager_user_name",
        headerName: "Reporting To",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 128,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const row = params.row as OrgUser;
          return (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClick(row);
                  }}
                >
                  <FiEdit />
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDeleteDialog(row);
                  }}
                >
                  <FiTrash2 />
                </IconButton>
              </Tooltip>
            </Box>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">
          {(error as any)?.message || "Failed to load users."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box
        className={cn(
          "glass-card rounded-2xl p-3 mb-3 flex items-center justify-between"
        )}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Users
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small"
            className="theme-button"
            onClick={() => {
              if (!orgId) return;
              navigate(`/org/${orgId}/organization/users/new`);
            }}
          >
            <FiPlus style={{ marginRight: 8 }} /> Add user
          </Button>
        </Box>
      </Box>

      {/* Grid */}
      <Box className="glass rounded-2xl" sx={{ p: 0, overflow: "hidden" }}>
        <DataGrid
          rows={pageRows}
          columns={columns}
          getRowId={(r) => r.id}
          pagination
          paginationMode="server"
          rowCount={visibleRows.length}
          pageSizeOptions={[5, 10, 20, 50]}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          loading={gridLoading || (isFetching && !gridLoading)}
          autoHeight
        />
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
        <DialogTitle>Delete employee</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deletingEmployee ? (
              <>
                Are you sure you want to delete <strong>{deletingEmployee.name}</strong>{" "}
                ({deletingEmployee.email})? This will remove the employee record and
                associated org user. This action cannot be undone.
              </>
            ) : (
              "Are you sure you want to delete this employee?"
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleteLoading}
            variant="contained"
            startIcon={deleteLoading ? <CircularProgress size={16} /> : undefined}
          >
            {deleteLoading ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
