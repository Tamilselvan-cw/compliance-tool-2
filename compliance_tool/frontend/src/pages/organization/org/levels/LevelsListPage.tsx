// ----------------------------------------------
// src/pages/organization/org/levels/LevelsPage.tsx
// Organization → Levels list with soft-loading + drawers
// ----------------------------------------------
import * as React from "react";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  MenuItem,
  Skeleton,
} from "@mui/material";
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid/models";
import {
  FiPlus,
  FiUpload,
  FiX,
  FiDownload,
  FiTrash2,
  FiEdit3,
} from "react-icons/fi";
import { useParams } from "react-router-dom";
import axios from "../../../../api/axiosInstance";
import { toast } from "../../../../components/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

/* ---------------- Types ---------------- */

type LevelDef = {
  id: string;
  organization_id?: string;
  name: string;
  description?: string | null;
  score: number;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
};

type LevelsListResp = {
  items: LevelDef[];
  total: number;
};

type ConfirmState = { open: boolean; id?: string; name?: string };

const REQUIRED_HEADERS = ["name", "description", "score"] as const;

/* ---------------- shared textfield styles ---------------- */

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

/* ---------------- API helpers ---------------- */

async function fetchOrgLevels(orgId: string): Promise<LevelDef[]> {
  const { data } = await axios.get<LevelsListResp>(
    `/organizations/${orgId}/levels`,
    { params: { only_active: true, limit: 100, page: 1 } }
  );
  return data.items ?? [];
}

const apiCreate = async (
  orgId: string,
  rec: Pick<LevelDef, "name" | "description" | "score">
) => {
  const payload = {
    name: rec.name,
    description: rec.description ?? "",
    score: rec.score,
  };
  const { data } = await axios.post(`/organizations/${orgId}/levels`, payload);
  return data as LevelDef;
};

const apiUpdate = async (
  orgId: string,
  id: string,
  rec: Pick<LevelDef, "name" | "description" | "score">
) => {
  const payload = {
    name: rec.name,
    description: rec.description ?? "",
    score: rec.score,
  };
  const { data } = await axios.patch(
    `/organizations/${orgId}/levels/${id}`,
    payload
  );
  return data as LevelDef;
};

const apiDelete = async (orgId: string, id: string) => {
  await axios.delete(`/organizations/${orgId}/levels/${id}`);
};

const parseCsv = async (file: File) => {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) throw new Error("File is empty.");

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) {
      throw new Error(`Missing required column: ${h}`);
    }
  }

  const nameIdx = headers.indexOf("name");
  const descIdx = headers.indexOf("description");
  const scoreIdx = headers.indexOf("score");

  const records: {
    name: string;
    description?: string;
    score: number;
  }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = cols[nameIdx];
    if (!name) continue;
    const description = descIdx >= 0 ? cols[descIdx] : "";
    const scoreRaw = cols[scoreIdx] ?? "0";
    const score = Number(scoreRaw);
    if (Number.isNaN(score)) {
      throw new Error(`Invalid score in line ${i + 1}`);
    }
    records.push({ name, description, score });
  }

  return records;
};

/* ---------------- Component ---------------- */

export default function LevelsPage() {
  const { orgId } = useParams<{ orgId: string }>();

  const storageKey = `org-${orgId ?? "unknown"}-levels-grid`;

  // pagination remembered across tab switches (same behaviour as UsersPage)
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

  const resolveOrg = () => {
    if (!orgId) throw new Error("Missing orgId in URL");
    return orgId;
  };

  // drawers
  const [drawer, setDrawer] = React.useState<
    "none" | "add" | "bulk" | "edit"
  >("none");
  const [editRow, setEditRow] = React.useState<LevelDef | null>(null);

  // delete confirm
  const [confirm, setConfirm] = React.useState<ConfirmState>({ open: false });

  const openConfirm = (row: LevelDef) =>
    setConfirm({ open: true, id: row.id, name: row.name });
  const closeConfirm = () => setConfirm({ open: false });

  const onConfirmDelete = async () => {
    if (!confirm.id) return;
    const id = confirm.id;
    closeConfirm();
    try {
      await apiDelete(resolveOrg(), id);
      toast({ title: "Level deleted" });
      await refetch();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description:
          err?.response?.data?.detail ||
          err?.message ||
          "Please try again.",
        variant: "destructive" as any,
      });
    }
  };

  /* ---------- React Query (soft loading) ---------- */

  const {
    data,
    isLoading,

    isError,
    error,
    refetch,
  } = useQuery<LevelDef[]>({
    queryKey: ["org-levels", orgId],
    queryFn: () => fetchOrgLevels(resolveOrg()),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 min cache – no refetch on every visit
    refetchOnWindowFocus: false,
  });

  // soft reload from AdminShell
  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ orgId?: string }>;
      if (!orgId || custom.detail?.orgId !== orgId) return;
      refetch();
    };
    window.addEventListener("org-soft-reload", handler as EventListener);
    return () =>
      window.removeEventListener("org-soft-reload", handler as EventListener);
  }, [orgId, refetch]);

  const allRows = data ?? [];

  const pageRows = React.useMemo(() => {
    const start = pagination.page * pagination.pageSize;
    return allRows.slice(start, start + pagination.pageSize);
  }, [allRows, pagination]);

  // show skeleton only on first load (same pattern as dashboard)
  const showSkeletons = isLoading && !data;

  // 2 fake skeleton rows inside DataGrid so it looks like a table
  const skeletonRows: LevelDef[] = React.useMemo(
    () =>
      showSkeletons
        ? [
            {
              id: "s1",
              name: "",
              description: "",
              score: 0,
              created_at: "",
            },
            {
              id: "s2",
              name: "",
              description: "",
              score: 0,
              created_at: "",
            },
          ]
        : [],
    [showSkeletons]
  );

  const rowsToUse = showSkeletons ? skeletonRows : pageRows;
  const totalRowCount = showSkeletons ? skeletonRows.length : allRows.length;

  /* ---------- columns ---------- */

  const columns = React.useMemo<GridColDef<LevelDef>[]>(
    () => [
      {
        field: "name",
        headerName: "Level name",
        flex: 1.2,
        minWidth: 200,
        renderCell: (params) =>
          showSkeletons ? (
            <Skeleton variant="text" width="80%" />
          ) : (
            params.value
          ),
      },
      {
        field: "description",
        headerName: "Description",
        flex: 1.6,
        minWidth: 260,
        renderCell: (p) =>
          showSkeletons ? (
            <Skeleton variant="text" width="90%" />
          ) : (
            <span style={{ color: "var(--color-text-muted)" }}>
              {(p.value as string) || ""}
            </span>
          ),
      },
      {
        field: "score",
        headerName: "Score",
        width: 120,
        type: "number",
        renderCell: (p) =>
          showSkeletons ? (
            <Skeleton variant="text" width={40} />
          ) : (
            Number(p.value ?? 0).toFixed(0)
          ),
      },
      {
        field: "is_active",
        headerName: "Status",
        width: 120,
        renderCell: (p) =>
          showSkeletons ? (
            <Skeleton
              variant="rectangular"
              width={70}
              height={20}
              sx={{ borderRadius: 999 }}
            />
          ) : p.value ? (
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(34,197,94,0.12)",
                color: "rgb(22,163,74)",
              }}
            >
              Active
            </span>
          ) : (
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(148,163,184,0.16)",
                color: "rgb(71,85,105)",
              }}
            >
              Inactive
            </span>
          ),
      },
      {
        field: "actions",
        headerName: "",
        width: 96,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: ({ row }) =>
          showSkeletons ? (
            <Skeleton
              variant="rectangular"
              width={64}
              height={24}
              sx={{ borderRadius: 1 }}
            />
          ) : (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <IconButton
                size="small"
                title="Edit"
                onClick={() => {
                  setEditRow(row);
                  setDrawer("edit");
                }}
              >
                <FiEdit3 />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => openConfirm(row)}
                title="Delete"
              >
                <FiTrash2 />
              </IconButton>
            </Box>
          ),
      },
    ],
    [showSkeletons]
  );

  /* ---------- create / edit handlers ---------- */

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const scoreStr = String(fd.get("score") || "").trim();
    const score = Number(scoreStr || "0");

    if (!name) {
      toast({
        title: "Name is required",
        variant: "destructive" as any,
      });
      return;
    }
    if (Number.isNaN(score) || score <= 0) {
      toast({
        title: "Score must be a positive number",
        variant: "destructive" as any,
      });
      return;
    }

    try {
      if (drawer === "edit" && editRow) {
        await apiUpdate(resolveOrg(), editRow.id, { name, description, score });
        toast({ title: "Level updated" });
      } else {
        await apiCreate(resolveOrg(), { name, description, score });
        toast({ title: "Level created" });
      }
      setDrawer("none");
      setEditRow(null);
      await refetch();
    } catch (err: any) {
      toast({
        title: "Save failed",
        description:
          err?.response?.data?.detail ||
          err?.message ||
          "Please try again.",
        variant: "destructive" as any,
      });
    }
  };

  /* ---------- bulk upload ---------- */

  const [bulkMode, setBulkMode] = React.useState<
    "replace" | "append" | "ignore"
  >("append");

  const onBulk = async (file: File) => {
    try {
      const records = await parseCsv(file);
      if (!records.length) {
        toast({ title: "No records found in file" });
        return;
      }

      await Promise.all(
        records.map((rec) =>
          apiCreate(resolveOrg(), {
            name: rec.name,
            description: rec.description ?? "",
            score: rec.score,
          })
        )
      );

      toast({
        title: "Bulk upload completed",
        description: `${records.length} levels processed.`,
      });
      setDrawer("none");
      setEditRow(null);
      await refetch();
    } catch (err: any) {
      toast({
        title: "Bulk upload failed",
        description:
          err?.message ||
          err?.response?.data?.detail ||
          "Please check the file format.",
        variant: "destructive" as any,
      });
    }
  };

  /* ---------- UI ---------- */

  const formDefaults = React.useMemo(() => {
    if (drawer === "edit" && editRow) {
      return {
        name: editRow.name,
        description: editRow.description ?? "",
        score: String(editRow.score),
      };
    }
    return { name: "", description: "", score: "" };
  }, [drawer, editRow]);

  return (
    <Box sx={{ m: 1.5 }}>
      {/* Toolbar */}
      <Box className="glass-card rounded-2xl p-3 mb-3 flex items-center justify-between">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Levels
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small"
            className="theme-button"
            onClick={() => {
              setEditRow(null);
              setDrawer("add");
            }}
          >
            <FiPlus style={{ marginRight: 8 }} /> Add level
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setEditRow(null);
              setDrawer("bulk");
            }}
          >
            <FiUpload style={{ marginRight: 8 }} /> Upload bulk
          </Button>
        </Box>
      </Box>

      {/* Data Grid */}
      <Box
        className="glass rounded-2xl"
        sx={{
          p: 0,
          overflow: "auto",       // 👈 no fixed width; scrolls when data grows
          minHeight: 220,
        }}
      >
        <DataGrid
          rows={rowsToUse}
          columns={columns}
          getRowId={(r) => r.id}
          checkboxSelection={!showSkeletons} // disable checkboxes while loading
          disableRowSelectionOnClick={false}
          pagination
          paginationMode="server"
          rowCount={totalRowCount}
          pageSizeOptions={[5, 10, 20, 50]}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          // 👇 IMPORTANT: NO loading prop – we control skeleton ourselves
          sx={{
            "--DataGrid-rowHeight": "36px",
            "& .MuiDataGrid-columnHeaders": {
              minHeight: 40,
              maxHeight: 40,
              background: "rgba(255,255,255,0.18)",
              borderBottom: "1px solid rgba(255,255,255,0.15)",
            },
            "& .MuiDataGrid-columnHeader": { px: 0.5 },
            "& .MuiDataGrid-cell": { px: 0.5 },
            "& .MuiDataGrid-columnSeparator": { display: "none" },
          }}
          slots={{
            toolbar: () => (
              <GridToolbarContainer
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  px: 2,
                  py: 1,
                  backdropFilter: "blur(10px)",
                  background: "rgba(255,255,255,0.18)",
                  borderBottom: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <Box   sx={{
                    minWidth: 180,
                    "& .MuiInputBase-root": {
                      borderRadius: 999,
                      fontSize: 13,
                      px: 1.5,
                      py: 0.25,
                    },
                    "& .MuiInputBase-input": {
                      fontSize: 13,
                    },
                  }}></Box>
                <GridToolbarQuickFilter
               
                 
                />
                <Button
                  size="small"
                  startIcon={<FiDownload />}
                  onClick={() => {
                    const header = "name,description,score\n";
                    const body = allRows
                      .map(
                        (r) =>
                          `"${(r.name || "").replace(/"/g, '""')}","${(
                            r.description || ""
                          ).replace(/"/g, '""')}",${r.score}`
                      )
                      .join("\n");
                    const blob = new Blob([header + body], {
                      type: "text/csv;charset=utf-8;",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "levels.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export
                </Button>
              </GridToolbarContainer>
            ),
          }}
        />
      </Box>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={drawer !== "none"}
        onClose={() => {
          setDrawer("none");
          setEditRow(null);
        }}
      >
        <Box sx={{ width: { xs: 360, sm: 440 }, p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18 }}>
              {drawer === "edit"
                ? "Edit level"
                : drawer === "bulk"
                ? "Bulk upload"
                : "Add level"}
            </Typography>
            <IconButton
              size="small"
              onClick={() => {
                setDrawer("none");
                setEditRow(null);
              }}
            >
              <FiX />
            </IconButton>
          </Box>

          {drawer === "add" || drawer === "edit" ? (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                name="name"
                label="Level name"
                defaultValue={formDefaults.name}
                margin="normal"
                size="small"
                sx={textFieldSx}
              />
              <TextField
                fullWidth
                name="description"
                label="Description"
                defaultValue={formDefaults.description}
                margin="normal"
                size="small"
                multiline
                minRows={2}
                sx={textFieldSx}
              />
              <TextField
                fullWidth
                name="score"
                label="Score"
                defaultValue={formDefaults.score}
                margin="normal"
                size="small"
                type="number"
                sx={textFieldSx}
              />
              <Box sx={{ mt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  className="theme-button"
                  fullWidth
                  sx={{ py: 1.1, textTransform: "none", fontSize: 15 }}
                >
                  {drawer === "edit" ? "Update level" : "Save level"}
                </Button>
              </Box>
              {isError && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  {(error as any)?.message || "Failed to load levels."}
                </Typography>
              )}
            </Box>
          ) : drawer === "bulk" ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Upload a CSV file with columns: <strong>name</strong>,{" "}
                <strong>description</strong>, <strong>score</strong>.
              </Typography>

              <TextField
                select
                label="When a level with same name exists"
                size="small"
                fullWidth
                margin="normal"
                value={bulkMode}
                onChange={(e) =>
                  setBulkMode(e.target.value as "replace" | "append" | "ignore")
                }
              >
                <MenuItem value="append">
                  Append as new (leave existing untouched)
                </MenuItem>
                <MenuItem value="replace">
                  Replace existing (same name)
                </MenuItem>
                <MenuItem value="ignore">
                  Ignore duplicates (keep existing)
                </MenuItem>
              </TextField>

              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 1.5 }}
                component="label"
              >
                <FiUpload style={{ marginRight: 8 }} />
                Choose CSV file
                <input
                  hidden
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onBulk(f);
                  }}
                />
              </Button>

              {isError && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  {(error as any)?.message || "Failed to load levels."}
                </Typography>
              )}
            </Box>
          ) : null}
        </Box>
      </Drawer>

      {/* Confirm Delete */}
      <Dialog open={confirm.open} onClose={closeConfirm}>
        <DialogTitle>Delete level?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove <strong>{confirm.name}</strong>. This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm}>Cancel</Button>
          <Button color="error" onClick={onConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
