import * as React from "react";
import {
  Box,
  Button,
  Chip,
  Snackbar,
  Alert,
  TextField,
  Typography,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Drawer,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { Autocomplete } from "@mui/material";
import { DataGrid, GridToolbarContainer } from "@mui/x-data-grid";
import type { GridColDef, GridSortModel } from "@mui/x-data-grid/models";
import { FiRefreshCw, FiDownload, FiTrash2, FiPlus, FiEdit2 } from "react-icons/fi";
import { useParams } from "react-router-dom";
import axios from "../../../api/axiosInstance";

/* ---------- API shape ---------- */
type CompetencyItem = {
  org_id?: string;
  department_id?: string | null;
  department_code?: string | null;
  department_name?: string | null;
  role_id?: string | null;
  role_code?: string | null;
  role_title?: string | null;
  level_name?: string | null;
  competency_id: string;
  competency_code?: string | null;
  competency_name?: string | null;
  competency_category?: "technical" | "functional" | "behavioral" | string;
  competency_description?: string | null;
  roles?: Array<{
    role_id?: string | null;
    role_code?: string | null;
    role_title?: string | null;
    department_id?: string | null;
    department_code?: string | null;
    department_name?: string | null;
  }>;
  roles_by_department?: Record<string, any>;
  expected_level?: number | null;
  scope?: string | null; // <-- scope field (core / organization / role / etc)
  [k: string]: any;
};

type ApiResponse = {
  items: CompetencyItem[];
  total: number;
  page: number;
  limit: number;
};

/* ---------- Helpers ---------- */
const useDebouncedValue = (value: string, delay = 300) => {
  const [deb, setDeb] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
};

function buildCompetencyCode(r: CompetencyItem | Record<string, any>) {
  const dept = (r as any)?.department_code ?? "";
  const role = (r as any)?.role_code ?? "";
  const comp = (r as any)?.competency_code ?? "";
  const parts = [dept, role, comp]
    .map((p: string) => (p ?? "").toString().trim())
    .filter(Boolean);
  return parts.length ? parts.join("-") : "—";
}

function mapCategoryLabel(cat?: string) {
  if (!cat) return "—";
  switch (cat.toString().toLowerCase()) {
    case "technical":
      return "Technical";
    case "functional":
      return "Functional";
    case "behavioral":
      return "Behavioral";
    default:
      return cat.charAt(0).toUpperCase() + cat.slice(1);
  }
}

function getCategoryMeta(row: CompetencyItem | Record<string, any>) {
  const label = mapCategoryLabel(row?.competency_category);

  const defaultDescs: Record<string, string> = {
    Technical: "Technical competencies (hard skills, tooling…)",
    Functional: "Functional/domain competencies tied to the role",
    Behavioral: "Behavioral/soft competencies (communication, teamwork…)",
  };

  const desc = row?.competency_description ?? defaultDescs[label] ?? "—";

  const color =
    (label === "Technical" && "primary") ||
    (label === "Functional" && "success") ||
    (label === "Behavioral" && "secondary") ||
    "default";

  return { color: color as any, label, desc };
}

function mapScopeLabel(scope?: string) {
  if (!scope) return { label: "Unknown", title: "Unknown scope" };
  const s = scope.toString().toLowerCase();
  if (s === "core") return { label: "Core", title: "Global core competency (no org)" };
  if (s === "organization" || s === "organization_only" || s === "org") {
    return { label: "Organization", title: "Organization-scoped competency" };
  }
  if (s === "role" || s === "role_based" || s === "role-based") {
    return { label: "Role based", title: "Role-based competency" };
  }
  const nice = s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: nice, title: `Scope: ${nice}` };
}

/* ---------- Main Component ---------- */
export default function CompetencyDictionaryPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [rows, setRows] = React.useState<CompetencyItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // client filters (AND)
  const [deptSel, setDeptSel] = React.useState<string[]>([]);
  const [roleSel, setRoleSel] = React.useState<string[]>([]);
  const [textSearch, setTextSearch] = React.useState("");
  const debouncedText = useDebouncedValue(textSearch, 250);

  // NEW: scope filter: all | core | organization | role_based
  const [scopeFilter, setScopeFilter] = React.useState<
    "all" | "core" | "organization" | "role_based"
  >("all");

  // sort
  const [sortModel, setSortModel] = React.useState<GridSortModel>([
    { field: "competency_name", sort: "asc" },
  ]);

  const PAGE_LIMIT = 100;

  // drawer + edit state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formName, setFormName] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formCategory, setFormCategory] = React.useState<
    "technical" | "functional" | "behavioral" | string
  >("technical");
  const [saving, setSaving] = React.useState(false);

  // is the current editing item a core competency?
  const [isCore, setIsCore] = React.useState(false);

  // delete confirm dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CompetencyItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const fetchData = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);

      try {
        // inside fetchData()
        const params: any = { limit: PAGE_LIMIT, page: 1 };

        // dropdown values: "all" | "core" | "organization" | "role_based"
        if (scopeFilter === "all") {
          // per your request: "all" should call scope=organization (which returns core + org)
          params.scope = "organization";
        } else if (scopeFilter === "core") {
          params.scope = "core";
        } else if (scopeFilter === "role_based") {
          params.scope = "role_based";
        } else if (scopeFilter === "organization") {
          // explicit "organization" dropdown = organization-only (no core)
          params.scope = "organization_only";
        }

        // text search
        if (debouncedText.trim()) params.q = debouncedText.trim();

        // if you want role-based call with role_id when a role is selected in UI:
        if (roleSel.length === 1) {
          params.role_id = roleSel[0]; // send single selected role id
        }

        if (debouncedText.trim()) params.q = debouncedText.trim();

        // fetch competency dictionary for this org
        const resp = await axios.get<ApiResponse>(
          `/organizations/${orgId}/competency-dictionary`,
          { params, signal }
        );

        const items = (resp.data?.items ?? []).map((r: any, idx: number) => {
          const competency_id =
            r?.competency_id ?? r?.id ?? `__tmp_${orgId ?? "org"}_${idx}`;

          // normalize scope & roles fields so client filtering renders correctly
          const scope = (r.scope ?? r.scope_type ?? r.competency_scope ?? r.competency_scope ?? "").toString();

          return {
            ...r,
            id: competency_id,
            competency_id,
            scope,
            // ensure roles and roles_by_department shape is safe
            roles: Array.isArray(r?.roles) ? r.roles : [],
            roles_by_department:
              r?.roles_by_department && typeof r.roles_by_department === "object"
                ? r.roles_by_department
                : {},
          } as CompetencyItem & { id: string };
        });

        setRows(items);

        try {
          (window as any).__debug_rows = items;
          // eslint-disable-next-line no-console
          console.info(`CompetencyDictionary: fetched ${items.length} rows for org ${orgId}`);
        } catch {
          /* ignore */
        }
      } catch (e: any) {
        if (
          e?.code === "ERR_CANCELED" ||
          e?.name === "CanceledError" ||
          e?.message === "canceled"
        ) {
          return;
        }
        setError(
          e?.response?.data?.detail ||
            e?.message ||
            "Failed to load competency dictionary"
        );
      } finally {
        setLoading(false);
      }
    },
    [orgId, debouncedText, scopeFilter, roleSel]
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchData]);

  /* ---------- Dropdown Options (derived) ---------- */
  type DeptOpt = {
    id: string;
    code: string | null;
    title: string;
    department_id: string | null;
  };
  type RoleOpt = {
    id: string;
    role_id: string;
    code: string | null;
    title: string;
    department_id?: string | null;
    department_code?: string | null;
  };

  const deptOptions: DeptOpt[] = React.useMemo(() => {
    const map = new Map<string, DeptOpt>();
    rows.forEach((r) => {
      const byDept = (r as any).roles_by_department || {};
      Object.entries(byDept).forEach(([deptName, rolesArr]: [string, any]) => {
        if (!deptName) return;
        const first = Array.isArray(rolesArr) && rolesArr.length ? rolesArr[0] : null;
        const department_id = first?.department_id ?? null;
        const department_code = first?.department_code ?? null;
        const key = String(department_code || department_id || deptName);
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            code: department_code,
            title: deptName,
            department_id: department_id,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const ca = (a.code ?? a.title ?? "").toString();
      const cb = (b.code ?? b.title ?? "").toString();
      const cmp = ca.localeCompare(cb);
      return cmp !== 0 ? cmp : (a.title ?? "").localeCompare(b.title ?? "");
    });
  }, [rows]);

  const roleOptions: RoleOpt[] = React.useMemo(() => {
    const map = new Map<string, RoleOpt>();
    rows.forEach((r) => {
      const rolesList = (r as any).roles || [];
      rolesList.forEach((roleObj: any) => {
        if (!roleObj || typeof roleObj !== "object" || !roleObj.role_id) return;
        const id = String(roleObj.role_id);
        if (!map.has(id)) {
          map.set(id, {
            id,
            role_id: id,
            code: (roleObj.role_code ?? null) as string | null,
            title: (roleObj.role_title ?? roleObj.title ?? "") as string,
            department_id: roleObj.department_id ?? null,
            department_code: roleObj.department_code ?? null,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const ca = (a.code ?? "").toString();
      const cb = (b.code ?? "").toString();
      const c = ca.localeCompare(cb);
      return c !== 0 ? c : (a.title ?? "").localeCompare(b.title ?? "");
    });
  }, [rows]);

  /* ---------- Client AND filter ---------- */
  const filteredRows = React.useMemo(() => {
    const txt = debouncedText.trim().toLowerCase();

    const competencyHasDept = (r: any, deptCodesOrIds: string[]) => {
      if (!deptCodesOrIds || !deptCodesOrIds.length) return true;
      const byDept = r.roles_by_department || {};
      for (const [_deptName, rolesArr] of Object.entries(byDept)) {
        if (!Array.isArray(rolesArr) || rolesArr.length === 0) continue;
        const first = rolesArr[0];
        const deptCode = first?.department_code ?? "";
        const deptId = first?.department_id ?? "";
        if (deptCodesOrIds.includes(String(deptCode))) return true;
        if (deptCodesOrIds.includes(String(deptId))) return true;
      }
      return false;
    };

    const competencyHasRole = (r: any, roleIds: string[]) => {
      if (!roleIds || !roleIds.length) return true;
      const roles = r.roles || [];
      for (const roleObj of roles) {
        if (!roleObj) continue;
        if (roleIds.includes(String(roleObj.role_id))) return true;
      }
      return false;
    };

    const matchesScope = (r: any, scopeSel: string) => {
      if (!scopeSel || scopeSel === "all") return true;
      const s = (r?.scope ?? r?.scope_type ?? r?.competency_scope ?? r?.competency_scope ?? "").toString().toLowerCase();
      if (scopeSel === "role_based")
        return s === "role" || s === "role_based" || s === "role-based";
      // explicit organization-only selection matches 'organization' value
      return s === scopeSel;
    };

    try {
      return rows.filter((r) => {
        if (deptSel.length) {
          if (!competencyHasDept(r, deptSel)) return false;
        }

        if (roleSel.length) {
          if (!competencyHasRole(r, roleSel)) return false;
        }

        if (!matchesScope(r, scopeFilter)) return false;

        if (txt) {
          const hay = [
            r.competency_id,
            r.competency_code,
            r.competency_name,
            r.competency_description,
            r.competency_category,
          ].map((v: any) => (v ?? "").toString().toLowerCase());

          if (hay.some((h) => h.includes(txt))) return true;

          const roles = r.roles || [];
          for (const roleObj of roles) {
            if (!roleObj || typeof roleObj !== "object") continue;
            const parts = [
              roleObj.role_title ?? "",
              roleObj.role_code ?? "",
              roleObj.department_name ?? "",
              roleObj.department_code ?? "",
            ].map((v: any) => (v ?? "").toString().toLowerCase());
            if (parts.some((p) => p.includes(txt))) return true;
          }

          return false;
        }

        return true;
      });
    } catch (err) {
      // If something unexpected happens, fallback gracefully
      // eslint-disable-next-line no-console
      console.error("filter error:", err);
      return rows;
    }
  }, [rows, deptSel, roleSel, debouncedText, scopeFilter]);

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug("filteredRows count:", filteredRows.length);
  }, [filteredRows.length]);

  /* ---------- CSV Export ---------- */
  const handleExport = () => {
    const headers = [
      "competency_code",
      "competency_name",
      "competency_description",
      "expected_level",
      "competency_category",
      "department_code",
      "role_code",
      "scope",
    ];
    const esc = (s: any) =>
      `"${String(s ?? "").replaceAll('"', '""').replace(/\r?\n/g, " ")}"`;
    const csv =
      headers.join(",") +
      "\n" +
      filteredRows
        .map((r) =>
          [
            buildCompetencyCode(r),
            r.competency_name ?? "",
            r.competency_description ?? "",
            r.expected_level ?? "",
            mapCategoryLabel(r.competency_category ?? ""),
            r.department_code ?? "",
            r.role_code ?? "",
            (r.scope ?? "") as any,
          ]
            .map(esc)
            .join(",")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `competency_dictionary_${orgId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ---------- Columns (fully defensive) ---------- */
  const cols = React.useMemo<GridColDef<CompetencyItem>[]>(() => {
    const safeRow = (params?: any): CompetencyItem | {} => {
      if (!params) return {};
      return (params.row ?? params.data) ?? {};
    };
    const safeBuildCode = (params?: any) => {
      const row = safeRow(params) as CompetencyItem;
      try {
        return buildCompetencyCode(row) ?? "—";
      } catch {
        return "—";
      }
    };

    return [
      {
        field: "competency_code_combined",
        headerName: "Competency Code",
        width: 260,
        sortable: true,
        valueGetter: (params) => safeBuildCode(params),
        renderCell: (params) => {
          try {
            const code = safeBuildCode(params);
            return (
              <Chip
                label={code}
                variant="outlined"
                size="small"
                sx={{ fontWeight: 700 }}
              />
            );
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("renderCell(code) error:", err, params);
            return <Chip label="—" size="small" />;
          }
        },
      },
      {
        field: "competency_name",
        headerName: "Competency Name",
        minWidth: 260,
        flex: 1,
        sortable: true,
        renderCell: (params) => {
          try {
            const row = safeRow(params) as CompetencyItem;
            // clicking the name opens edit drawer
            return (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, cursor: "pointer" }}
                  onClick={() => {
                    // open edit drawer for this row
                    const id = (row as any).competency_id ?? (row as any).id;
                    if (!id) return;
                    setEditId(String(id));
                    setFormName(row?.competency_name ?? "");
                    setFormDescription(row?.competency_description ?? "");
                    setFormCategory(row?.competency_category ?? "technical");
                    const rawScope = (row?.scope ?? "").toString().toLowerCase();
                    setIsCore(rawScope === "core");
                    setDrawerOpen(true);
                  }}
                >
                  {row?.competency_name ?? "—"}
                </Typography>
              </Box>
            );
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("renderCell(name) error:", err, params);
            return <Typography variant="body2">—</Typography>;
          }
        },
      },
      {
        field: "competency_description",
        headerName: "Description",
        minWidth: 320,
        flex: 1,
        sortable: false,
        renderCell: (params) => {
          try {
            const row = safeRow(params) as CompetencyItem;
            const desc = row?.competency_description || "—";
            return (
              <Tooltip title={desc.length > 80 ? desc : ""}>
                <Typography
                  variant="body2"
                  sx={{
                    fontStyle: desc && desc !== "—" ? "normal" : "italic",
                    color: desc && desc !== "—" ? "text.primary" : "text.disabled",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}
                >
                  {desc || "No description"}
                </Typography>
              </Tooltip>
            );
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("renderCell(desc) error:", err, params);
            return <Typography variant="body2">—</Typography>;
          }
        },
      },
      {
        field: "scope_label",
        headerName: "Scope",
        width: 160,
        sortable: true,
        renderCell: (params) => {
          try {
            const row = safeRow(params) as CompetencyItem;
            const rawScope = (row.scope ?? row.competency_scope ?? "").toString();
            const meta = mapScopeLabel(rawScope);
            // small chip + tooltip
            return (
              <Tooltip title={meta.title}>
                <Chip
                  size="small"
                  label={meta.label}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              </Tooltip>
            );
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("renderCell(scope) error:", err, params);
            return <Chip size="small" label="—" />;
          }
        },
      },
      {
        field: "category",
        headerName: "Category",
        width: 160,
        sortable: true,
        renderCell: (params) => {
          try {
            const row = safeRow(params) as CompetencyItem;
            const meta = getCategoryMeta(row);
            return (
              <Tooltip title={meta.desc}>
                <Chip size="small" color={meta.color} label={meta.label} />
              </Tooltip>
            );
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("renderCell(category) error:", err, params);
            return <Chip size="small" label="—" />;
          }
        },
      },
    ];
  }, []);

  /* ---------- Minimal actions row (optional) ---------- */
  function ActionsBar() {
    return (
      <GridToolbarContainer
        sx={{
          px: 1,
          py: 1,
          display: "flex",
          gap: 1,
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(255,255,255,0.25)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          Competency Dictionary
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Showing {filteredRows.length}
          </Typography>
          <Button
            size="small"
            startIcon={<FiRefreshCw />}
            onClick={() => fetchData()}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            size="small"
            startIcon={<FiDownload />}
            onClick={handleExport}
            disabled={!filteredRows.length}
          >
            Export CSV
          </Button>

          {/* ADD button (toolbar) */}
          <Button
            size="small"
            startIcon={<FiPlus />}
            onClick={() => {
              // open create drawer
              setEditId(null);
              setFormName("");
              setFormDescription("");
              setFormCategory("technical");
              setIsCore(false);
              setDrawerOpen(true);
            }}
          >
            Add Competency
          </Button>

          <Button
            size="small"
            color="error"
            startIcon={<FiTrash2 />}
            onClick={() => {
              setDeptSel([]);
              setRoleSel([]);
              setTextSearch("");
              setScopeFilter("all");
            }}
          >
            Clear
          </Button>
        </Stack>
      </GridToolbarContainer>
    );
  }

  /* ---------- Drawer handlers: create / update ---------- */
  const handleCloseDrawer = () => {
    if (!saving) setDrawerOpen(false);
  };

  const handleSave = async () => {
    if (!orgId) {
      setError("missing org context");
      return;
    }
    if (!formName.trim()) {
      setError("name required");
      return;
    }

    // Prevent editing core competencies
    if (editId && isCore) {
      setError("Core competencies are read-only and cannot be modified.");
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        // PATCH: only send fields allowed to change (omit scope)
        const payload: any = {};
        if (formName.trim()) payload.name = formName.trim();
        payload.description = formDescription.trim() || null;
        payload.category = formCategory;

        // correct endpoint: PATCH /competencys/{id} with org_id query param
        await axios.patch(`/competencys/competencys/${encodeURIComponent(editId)}`, payload, {
          params: { org_id: orgId },
        });
      } else {
        // CREATE: include scope and org
        const payload = {
          name: formName.trim(),
          description: formDescription.trim() || null,
          category: formCategory,
          scope: "organization", // create as organization-scoped by default
          organization_id: orgId,
        };

        // correct endpoint: POST /competencys with org_id optional query param
        await axios.post("/competencys/competencys", payload, { params: { org_id: orgId } });
      }

      setDrawerOpen(false);
      await fetchData();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || err?.response?.data || err?.message || "Failed to save"
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Delete handlers ---------- */
  const openDeleteDialog = (row: CompetencyItem) => {
    setDeleteTarget(row);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const cid = deleteTarget.competency_id ?? (deleteTarget as any).id;
    if (!cid || !orgId) {
      setError("missing competency id or org");
      return;
    }

    // Prevent deleting core competencies
    const rawScope = (deleteTarget.scope ?? "").toString().toLowerCase();
    if (rawScope === "core") {
      setError("Core competencies are read-only and cannot be deleted.");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    try {
      // correct endpoint: DELETE /competencys/{id}
      await axios.delete(`/competencys/competencys/${encodeURIComponent(String(cid))}`, {
        params: { org_id: orgId, soft: true },
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- Columns already include edit button; add row-level delete if you want ---------- */
  const columnsWithActions = React.useMemo(() => {
    const actionCol: GridColDef = {
      field: "_actions",
      headerName: "Actions",
      width: 120,
      sortable: false,
      renderCell: (params) => {
        const r = params.row as CompetencyItem;
        return (
          <Stack direction="row" spacing={1}>
            <IconButton
              size="small"
              onClick={() => {
                const id = r.competency_id ?? (r as any).id;
                setEditId(String(id));
                setFormName(r?.competency_name ?? "");
                setFormDescription(r?.competency_description ?? "");
                setFormCategory(r?.competency_category ?? "technical");
                const rawScope = (r?.scope ?? "").toString().toLowerCase();
                setIsCore(rawScope === "core");
                setDrawerOpen(true);
              }}
            >
              <FiEdit2 />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => openDeleteDialog(r)}
            >
              <FiTrash2 />
            </IconButton>
          </Stack>
        );
      },
    };
    return [...cols, actionCol];
  }, [cols]);

  /* ---------- Clean filter bar ABOVE table ---------- */
  const chipLabel = (o: { id: string; code?: string | null; title: string }) =>
    `${(o.code ?? "—").toString()} • ${o.title || "-"}`;

  return (
    <Box sx={{ width: "100%", maxWidth: "100%" }}>
      {/* Filter bar */}
      <Box
        sx={{
          width: "100%",
          maxWidth: "100%",
          mb: 1.5,
          p: 1,
          borderRadius: 2,
          background: "rgba(255,255,255,0.6)",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr 220px" },
          gap: 1,
          alignItems: "center",
        }}
      >
        {/* Department dropdown (multi) */}
        <Autocomplete
          multiple
          options={deptOptions}
          value={deptOptions.filter((o) => deptSel.includes(o.id))}
          onChange={(_, val) => {
            setDeptSel(val.map((v) => v.id));
            setRoleSel([]);
          }}
          getOptionLabel={(o) => `${o.code} • ${o.title}`}
          openOnFocus
          renderTags={(value, getTagProps) =>
            value.map((opt, idx) => (
              <Chip
                {...getTagProps({ index: idx })}
                size="small"
                label={chipLabel(opt)}
              />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} label="Departments (Code • Title)" size="small" />
          )}
        />

        {/* Role dropdown (multi) */}
        <Autocomplete
          multiple
          options={roleOptions}
          value={roleOptions.filter((o) => roleSel.includes(o.role_id))}
          onChange={(_, val) => setRoleSel(val.map((v) => v.role_id))}
          getOptionLabel={(o) => `${o.code} • ${o.title}`}
          disableCloseOnSelect
          openOnFocus
          renderTags={(value, getTagProps) =>
            value.map((opt, idx) => (
              <Chip
                {...getTagProps({ index: idx })}
                size="small"
                label={`${opt.code} • ${opt.title}`}
              />
            ))
          }
          renderInput={(params) => <TextField {...params} label="Roles (Code • Name)" size="small" />}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Scope</InputLabel>
            <Select
              label="Scope"
              value={scopeFilter}
              onChange={(e) =>
                setScopeFilter(e.target.value as "all" | "core" | "organization" | "role_based")
              }
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="core">Core</MenuItem>
              <MenuItem value="organization">Organization</MenuItem>
              <MenuItem value="role_based">Role based</MenuItem>
            </Select>
          </FormControl>

        
      </Box>

      {/* Right-side controls: Scope filter + Add button */}
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" paddingBottom={0.5}>
          <TextField
            size="small"
            label="Search text (ID/code/name/category/description)"
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
          />

          <Button
            variant="contained"
            size="small"
            startIcon={<FiPlus />}
            onClick={() => {
              // open create drawer (organization-scoped by default)
              setEditId(null);
              setFormName("");
              setFormDescription("");
              setFormCategory("technical");
              setIsCore(false);
              setDrawerOpen(true);
            }}
          >
            Add Competency
          </Button>
        </Stack>
        

      {/* Table + simple actions bar */}
      <Box
        className="glass rounded-2xl"
        sx={{
          p: 0,
          overflow: "hidden",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <DataGrid
          rows={filteredRows as any}
          columns={columnsWithActions as any}
          getRowId={(r: any) => r?.id ?? r?.competency_id}
          loading={loading}
          autoHeight={false}
          density="comfortable"
          disableRowSelectionOnClick
          sortModel={sortModel}
          onSortModelChange={(m) => setSortModel(m)}
          slots={{ toolbar: ActionsBar }}
          sx={{
            minHeight: 300,
            background: "transparent",
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              background: "rgba(255,255,255,0.25)",
              backdropFilter: "blur(8px)",
            },
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            },
          }}
        />
      </Box>

      {/* Drawer: create / edit */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
      >
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {editId ? (isCore ? "View Competency (Core)" : "Edit Competency") : "Add Competency"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editId ? `ID: ${editId}` : `Organization: ${orgId ?? "—"}`}
              </Typography>
            </Box>
            <IconButton onClick={handleCloseDrawer} disabled={saving}>
              <FiTrash2 style={{ visibility: "hidden" }} />
            </IconButton>
          </Stack>

          <TextField
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            fullWidth
            required
            disabled={isCore}
          />

          <FormControl fullWidth disabled={isCore}>
            <InputLabel>Category</InputLabel>
            <Select
              label="Category"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as any)}
            >
              <MenuItem value="technical">Technical</MenuItem>
              <MenuItem value="functional">Functional</MenuItem>
              <MenuItem value="behavioral">Behavioral</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            disabled={isCore}
          />

          {isCore && (
            <Typography variant="caption" color="text.secondary">
              Core competencies are globally defined and read-only. To change them, update the central core competency source.
            </Typography>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={handleCloseDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || (editId ? isCore : false)}
            >
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </Stack>
        </Box>
      </Drawer>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Delete competency</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.competency_name ?? deleteTarget?.competency_id ?? "this competency"}</strong>?
          </Typography>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Related roles</Typography>
            {deleteTarget?.roles && deleteTarget.roles.length ? (
              <List dense>
                {deleteTarget.roles.map((r, idx) => (
                  <React.Fragment key={idx}>
                    <ListItem>
                      <ListItemText
                        primary={r.role_title ?? r.role_code ?? "—"}
                        secondary={`${r.department_name ?? ""} ${r.department_code ? ` • ${r.department_code}` : ""}`}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No related roles found.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setError(null)} severity="error" variant="filled" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
