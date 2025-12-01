// ----------------------------------------------
// src/pages/organization/org/SkillsPage.tsx
// single role skills/competency page
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
  Tabs,
  Tab,
} from "@mui/material";
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid/models";
import { FiPlus, FiUpload, FiX, FiDownload, FiTrash2 } from "react-icons/fi";
import { toast } from "../../../components/hooks/use-toast";
import { useParams, useLocation } from "react-router-dom";
import axios from "@/api/axiosInstance";
import { useQuery } from "@tanstack/react-query";

/* ----------------- constants & helpers ----------------- */

const MIN_PER_CATEGORY = 3 as const;

const CATEGORY_SET = [
  { id: "technical", name: "Technical" },
  { id: "functional", name: "Functional" },
  { id: "behavioral", name: "Behavioral" },
] as const;

type CatId = (typeof CATEGORY_SET)[number]["id"];

const CAT_LABEL: Record<CatId, string> = {
  technical: "Technical",
  functional: "Functional",
  behavioral: "Behavioral",
};

type LevelDef = {
  id: string;
  name: string;
  score: number;
  description?: string;
};
type Skill = {
  id: string;
  name: string;
  category?: string;
  description?: string;
};
type OrgRole = {
  id: string;
  organization_id: string;
  title?: string;
  name?: string;
};

type RoleSkillExpectation = {
  id: string;
  role_id: string;
  competency_id: string;
  expected_level: number;
  weight: number;
  competency?: Skill;
};

type SkillsPageQuery = {
  role: OrgRole | null;
  levels: LevelDef[];
  expectations: RoleSkillExpectation[];
};

const REQUIRED_HEADERS = [
  "competency_name",
  "category",
  "expected_level_score",
  "weight",
  "competency_description",
] as const;

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

const catName = (id?: string) =>
  CATEGORY_SET.find((c) => c.id === id)?.name ?? (id ?? "");

const roleDisplayName = (r?: OrgRole | null) =>
  (r && (r.name ?? r.title)) || "";

const computeProgress = (items: RoleSkillExpectation[]) => {
  const counts: Record<CatId, number> = {
    technical: 0,
    functional: 0,
    behavioral: 0,
  };
  for (const e of items) {
    const cat = ((e.competency?.category ?? "technical") as CatId) || "technical";
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  const frac = (c: number) => Math.min(1, c / MIN_PER_CATEGORY);
  const avg =
    (frac(counts.technical) +
      frac(counts.functional) +
      frac(counts.behavioral)) /
    3;
  const pct = avg * 100;
  const satisfied =
    Number(counts.technical >= MIN_PER_CATEGORY) +
    Number(counts.functional >= MIN_PER_CATEGORY) +
    Number(counts.behavioral >= MIN_PER_CATEGORY);
  return { counts, pct, satisfied };
};

/* ----------------- API loader for React Query ----------------- */

async function fetchRoleSkillsPage(
  orgId: string,
  roleId: string,
  hasNavTitle: boolean
): Promise<SkillsPageQuery> {
  const [roleMaybe, levelsRes, expectationsRes] = await Promise.all([
    hasNavTitle
      ? Promise.resolve<OrgRole | null>(null)
      : axios
          .get<OrgRole>(`/organizations/${orgId}/roles/${roleId}`)
          .then((r) => r.data),
    axios
      .get<{ items: LevelDef[] }>(`/organizations/${orgId}/levels`, {
        params: { only_active: true, page: 1, limit: 100 },
      })
      .then((r) => r.data),
    axios
      .get<{ items: RoleSkillExpectation[] }>(
        `/organizations/${orgId}/roles/${roleId}/competencys`,
        { params: { page: 1, limit: 500 } }
      )
      .then((r) => r.data),
  ]);

  return {
    role: roleMaybe,
    levels: levelsRes.items ?? [],
    expectations: expectationsRes.items ?? [],
  };
}

/* ----------------- Component ----------------- */

export default function SkillsPage() {
  const { orgId, roleId } = useParams<{ orgId: string; roleId: string }>();
  const location = useLocation();

  const navState = (location.state || {}) as {
    roleTitle?: string;
    roleDescriptions?: string[];
  };

  const hasNavTitle = !!navState.roleTitle;

  const resolveOrg = () => {
    if (!orgId) throw new Error("organization_id missing in URL");
    return orgId;
  };
  const resolveRole = () => {
    if (!roleId) throw new Error("role_id missing in URL");
    return roleId;
  };

  const storageKeyGrid = `org-${orgId ?? "x"}-role-${
    roleId ?? "x"
  }-skills-grid`;
  const storageKeyTab = `org-${orgId ?? "x"}-role-${roleId ?? "x"}-skills-tab`;

  const [activeTab, setActiveTab] = React.useState<CatId>(() => {
    if (typeof window === "undefined") return "technical";
    try {
      const saved = window.sessionStorage.getItem(storageKeyTab) as CatId | null;
      if (saved && ["technical", "functional", "behavioral"].includes(saved)) {
        return saved;
      }
    } catch {
      /* ignore */
    }
    return "technical";
  });

  const [pagination, setPagination] = React.useState<GridPaginationModel>(() => {
    if (typeof window === "undefined") return { page: 0, pageSize: 10 };
    try {
      const raw = window.sessionStorage.getItem(storageKeyGrid);
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
      /* ignore */
    }
    return { page: 0, pageSize: 10 };
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKeyGrid, JSON.stringify(pagination));
    } catch {
      /* ignore */
    }
  }, [pagination, storageKeyGrid]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKeyTab, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab, storageKeyTab]);

  // React Query loader
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<SkillsPageQuery>({
    queryKey: ["role-skills", orgId, roleId],
    queryFn: () => fetchRoleSkillsPage(resolveOrg(), resolveRole(), hasNavTitle),
    enabled: !!orgId && !!roleId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Soft reload from AdminShell
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

  const roleFromApi = data?.role ?? null;
  const levels = data?.levels ?? [];
  const expectations = data?.expectations ?? [];

  const roleName =
    navState.roleTitle || roleDisplayName(roleFromApi) || "Role";

  const roleDescText =
    navState.roleDescriptions && navState.roleDescriptions.length
      ? navState.roleDescriptions.join(" • ")
      : "";

  const completion = computeProgress(expectations);
  const categoryCounts = completion.counts;
  const coveragePct = Math.round(completion.pct);

  const filteredRows = expectations.filter(
    (e) => (e.competency?.category ?? "technical") === activeTab
  );

  const pageRows = React.useMemo(() => {
    const start = pagination.page * pagination.pageSize;
    return filteredRows.slice(start, start + pagination.pageSize);
  }, [filteredRows, pagination]);

  const gridLoading = isLoading || (isFetching && !isLoading);

  // Drawer state
  const [drawer, setDrawer] = React.useState<"none" | "add" | "bulk">("none");
  const [presetCategory, setPresetCategory] =
    React.useState<CatId>("technical");

  /* ----------------- columns ----------------- */

  const columns: GridColDef<RoleSkillExpectation>[] = React.useMemo(
    () => [
      {
        field: "competency",
        headerName: "Skill",
        flex: 1.4,
        minWidth: 260,
        sortable: true,
        renderCell: (p) => {
          const row = p.row;
          const s = row.competency;
          const name = s?.name ?? "";
          const category = catName(s?.category);
          return (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.1,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                  color: "var(--color-text)",
                  fontSize: 14,
                  lineHeight: "18px",
                }}
              >
                {name}
              </Typography>
              {category && (
                <Typography
                  sx={{
                    color: "var(--color-text-2)",
                    fontSize: 12,
                    lineHeight: "16px",
                    mt: "2px",
                  }}
                >
                  {category}
                </Typography>
              )}
              {s?.description?.trim() && (
                <Typography
                  sx={{
                    color: "var(--color-text-muted)",
                    fontSize: 12,
                    lineHeight: "16px",
                    mt: "2px",
                  }}
                >
                  {s.description}
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        field: "expected_level",
        headerName: "Expected Level",
        width: 170,
        sortable: true,
        renderCell: (p) => {
          const lvlNum = p.row.expected_level;
          const lvl = levels.find((l) => l.score === lvlNum);
          return (
            <Typography variant="body2" sx={{ color: "var(--color-text)" }}>
              {lvl ? `${lvl.name} (${lvl.score})` : ""}
            </Typography>
          );
        },
      },
      {
        field: "weight",
        headerName: "Weight",
        width: 96,
        sortable: true,
        renderCell: (p) => {
          const w = Number(p.row.weight);
          return (
            <Typography variant="body2" sx={{ color: "var(--color-text)" }}>
              {Number.isFinite(w) ? w.toFixed(2) : ""}
            </Typography>
          );
        },
      },
      {
        field: "_",
        headerName: "",
        width: 56,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <IconButton
            size="small"
            onClick={() => onDelete(row.id)}
            title="Delete"
          >
            <FiTrash2 />
          </IconButton>
        ),
      },
    ],
    [levels]
  );

  /* ----------------- actions ----------------- */

  const apiAddSkillToRole = async (payload: {
    competency_name: string;
    category: string;
    expected_level: number;
    weight: number;
    description?: string;
  }) => {
    await axios.post(
      `/organizations/${resolveOrg()}/roles/${resolveRole()}/competencys`,
      payload
    );
  };

  const apiBulkRoleSkills = async (
    items: Array<{
      competency_name: string;
      category: string;
      expected_level: number;
      weight: number;
      description?: string;
    }>
  ) => {
    await axios.post(
      `/organizations/${resolveOrg()}/roles/${resolveRole()}/competencys/bulk`,
      { items }
    );
  };

  const apiDeleteRoleSkill = async (expectationId: string) => {
    await axios.delete(
      `/organizations/${resolveOrg()}/roles/${resolveRole()}/competencys/${expectationId}`
    );
  };

  const onDelete = async (id: string) => {
    const ok = window.confirm("Remove this skill from the role?");
    if (!ok) return;

    try {
      await apiDeleteRoleSkill(id);
      toast({ title: "Removed skill from role" });
      await refetch();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.response?.data?.detail || err?.message,
        variant: "destructive" as any,
      });
    }
  };

  const onAddSingle: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const competency_name = String(fd.get("competency_name") || "").trim();
    const category = String(fd.get("category_id") || "").trim() as CatId;
    const expected = Number(fd.get("expected_level_score") || 0);
    const weight = Number(fd.get("weight") || 0);
    const description = String(fd.get("competency_description") || "").trim();

    if (
      !competency_name ||
      !expected ||
      !category
    ) {
      toast({
        title: "Invalid input",
        description:
          "Skill, category, expected level and 0 < weight ≤ 1 are required.",
        variant: "destructive" as any,
      });
      return;
    }

    try {
      await apiAddSkillToRole({
        competency_name,
        category,
        expected_level: expected,
        weight,
        description: description || undefined,
      });

      toast({
        title: "Skill added",
        description: `${competency_name} → ${roleName}`,
      });

      form.reset();
      setDrawer("none");
      await refetch();
    } catch (err: any) {
      toast({
        title: "Create failed",
        description: err?.response?.data?.detail || err?.message,
        variant: "destructive" as any,
      });
    }
  };

  const makeTemplateCsv = () => {
    const header = REQUIRED_HEADERS.join(",");
    const example = `React,technical,4,0.25,Core library & hooks`;
    const csv = header + "\n" + example + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "role-skills-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const invalid = REQUIRED_HEADERS.some((h, i) => header[i] !== h);
    if (invalid)
      throw new Error("Template not valid. Please use the provided template.");
    const out: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(",");
      const rec: any = {};
      REQUIRED_HEADERS.forEach(
        (h, idx) => (rec[h] = (c[idx] ?? "").trim())
      );
      out.push(rec);
    }
    return out;
  };

  const onBulk = async (file: File) => {
    try {
      const recs = await parseCsv(file);
      if (!recs.length) {
        toast({
          title: "No rows",
          description: "CSV seems empty.",
          variant: "destructive" as any,
        });
        return;
      }

      const items: Array<{
        competency_name: string;
        category: string;
        expected_level: number;
        weight: number;
        description?: string;
      }> = [];

      for (const r of recs) {
        const expected = Number(r.expected_level_score || 0);
        const weight = Number(r.weight || 0);
        const category = (r.category || "").toLowerCase() as CatId;

        if (
          !r.competency_name ||
          !category ||
          !expected ||
          weight <= 0 ||
          weight > 1
        ) {
          continue;
        }

        items.push({
          competency_name: r.competency_name.trim(),
          category,
          expected_level: expected,
          weight,
          description: (r.competency_description || "").trim() || undefined,
        });
      }

      if (!items.length) {
        toast({
          title: "No valid rows",
          description: "Nothing imported.",
          variant: "destructive" as any,
        });
        return;
      }

      await apiBulkRoleSkills(items);

      setDrawer("none");
      toast({
        title: "Bulk upload complete",
        description: `${items.length} rows processed`,
      });
      await refetch();
    } catch (err: any) {
      toast({
        title: "Template not valid",
        description: err?.message,
        variant: "destructive" as any,
      });
    }
  };

  if (!roleId) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Select a role from Roles page.</Typography>
      </Box>
    );
  }

  /* ----------------- UI ----------------- */

  return (
    <Box sx={{ minWidth: 0, overflow: "hidden" }}>
      {/* Role summary card (name + description + category coverage) */}
      <Box className="glass-card rounded-2xl p-3 mb-3">
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
          >
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: 16,
                color: "var(--color-text)",
              }}
            >
              Role overview: {roleName}
            </Typography>
            <Chip
              size="small"
              label={`Coverage: ${coveragePct}%`}
              sx={{
                bgcolor: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(0,0,0,0.06)",
                fontWeight: 600,
              }}
            />
          </Stack>

          {roleDescText && (
            <Typography
              variant="body2"
              sx={{ color: "var(--color-text-muted)" }}
            >
              {roleDescText}
            </Typography>
          )}

          <Stack
            direction="row"
            spacing={2}
            flexWrap="wrap"
            alignItems="stretch"
          >
            {(Object.keys(CAT_LABEL) as CatId[]).map((cat) => {
              const filled = categoryCounts[cat] ?? 0;
              const pct = Math.min(100, (filled / MIN_PER_CATEGORY) * 100);
              const done = filled >= MIN_PER_CATEGORY;
              return (
                <Box
                  key={cat}
                  sx={{
                    flex: "0 0 120px",
                    borderRadius: 2,
                    px: 1.3,
                    py: 1,
                    border: "1px solid rgba(0,0,0,0.04)",
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))",
                    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: "var(--color-text-2)",
                    }}
                  >
                    {CAT_LABEL[cat]}
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      width: "100%",
                      height: 6,
                      borderRadius: 3,
                      overflow: "hidden",
                      background: "rgba(148,163,184,0.22)",
                    }}
                  >
                    <Box
                      sx={{
                        width: `${pct}%`,
                        height: "100%",
                        background: done
                          ? "linear-gradient(90deg,var(--logo-green),var(--logo-blue))"
                          : "linear-gradient(90deg,#f97316,#facc15)",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 11,
                      color: done
                        ? "var(--logo-green)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    {filled}/{MIN_PER_CATEGORY} skills
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </Box>

      {/* Levels legend */}
      {levels.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 1.5, flexWrap: "wrap" }}
          alignItems="center"
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, textTransform: "uppercase" }}
          >
            Levels:
          </Typography>
          {levels.map((l) => (
            <Chip
              key={l.id}
              label={`${l.name} (${l.score})`}
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.6)",
                color: "var(--color-text-2)",
                height: 22,
                borderRadius: "999px",
                border: "1px solid rgba(148,163,184,0.4)",
                "& .MuiChip-label": {
                  fontSize: 12,
                  lineHeight: "18px",
                  px: 1,
                },
              }}
            />
          ))}
        </Stack>
      )}

      {/* Tabs card WITH buttons (replaces old top card) */}
      <Box className="glass-card rounded-2xl mb-1">
        <Box
          sx={{
            px: 2,
            pt: 1.5,
            pb: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
       <Tabs
          value={activeTab}
          onChange={(_, v: CatId) => {
            setActiveTab(v);
            // reset page when switching tab
            setPagination((prev) => ({ ...prev, page: 0 }));
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 40,
            mt: 0.5,
            px: 1,
            "& .MuiTab-root": { textTransform: "none", fontSize: 14 },
          }}
        >
          {CATEGORY_SET.map((c) => (
            <Tab key={c.id} value={c.id} label={c.name} />
          ))}
        </Tabs>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              className="theme-button"
              onClick={() => {
                setPresetCategory(activeTab);
                setDrawer("add");
              }}
            >
              <FiPlus style={{ marginRight: 8 }} /> Add skill
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setDrawer("bulk")}
            >
              <FiUpload style={{ marginRight: 8 }} /> Upload Bulk
            </Button>
          </Box>
        </Box>

 
      </Box>

      {/* Single grid for active tab */}
      <Box className="glass rounded-2xl" sx={{ p: 0, overflow: "hidden" }}>
        <DataGrid
          rows={pageRows}
          columns={columns}
          getRowId={(r) => r.id}
          checkboxSelection
          disableRowSelectionOnClick
          density="compact"
          hideFooterSelectedRowCount
          loading={gridLoading}
          pagination
          paginationMode="server"
          rowCount={filteredRows.length}
          pageSizeOptions={[5, 10, 20, 50]}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
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
                  borderBottom: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: "var(--color-text)" }}
                >
                  {CAT_LABEL[activeTab]} skills
                </Typography>
                <GridToolbarQuickFilter
                  quickFilterParser={(v) => v.split(" ")}
                />
              </GridToolbarContainer>
            ),
          }}
          sx={{
            background: "transparent",
            border: "none",
            color: "var(--color-text)",
            "--DataGrid-rowHeight": "36px",
            "& .MuiDataGrid-columnHeaders": {
              background: "rgba(255,255,255,0.25)",
              backdropFilter: "blur(8px)",
              borderBottom: "1px solid rgba(255,255,255,0.18)",
              fontWeight: 600,
              fontSize: "0.9rem",
              color: "var(--color-text)",
              minHeight: 38,
              maxHeight: 38,
            },
            "& .MuiDataGrid-cell": {
              color: "var(--color-text-muted)",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              px: 0.5,
            },
            "& .MuiDataGrid-footerContainer": {
              background: "rgba(255,255,255,0.12)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              color: "var(--color-text-muted)",
            },
          }}
        />
      </Box>

      {/* Drawer (Add / Bulk) */}
      <Drawer
        anchor="right"
        open={drawer !== "none"}
        onClose={() => {
          setDrawer("none");
        }}
      >
        <Box sx={{ width: { xs: 340, sm: 440 }, p: 2.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, fontSize: 18 }}
            >
              {drawer === "add" ? "Add skill to Role" : "Bulk upload"}
            </Typography>
            <IconButton
              size="small"
              onClick={() => {
                setDrawer("none");
              }}
            >
              <FiX />
            </IconButton>
          </Box>

          {drawer === "add" && (
            <form onSubmit={onAddSingle}>
              <Stack spacing={2}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "var(--color-text-2)",
                    }}
                  >
                    Role
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, mt: 0.25 }}
                  >
                    {roleName}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "var(--color-text-2)",
                    }}
                  >
                    Basic details
                  </Typography>
                  <Stack spacing={1.2} sx={{ mt: 0.75 }}>
                    <TextField
                      name="competency_name"
                      label="Skill name *"
                      fullWidth
                      required
                      size="small"
                      sx={textFieldSx}
                    />
                    <TextField
                      select
                      name="category_id"
                      label="Category *"
                      fullWidth
                      required
                      size="small"
                      sx={textFieldSx}
                      SelectProps={{ native: true }}
                      defaultValue={presetCategory}
                    >
                      {CATEGORY_SET.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </TextField>

                    <TextField
                      name="competency_description"
                      label="Description (optional)"
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      sx={textFieldSx}
                    />
                  </Stack>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "var(--color-text-2)",
                    }}
                  >
                    Level
                  </Typography>
                  <Stack spacing={1.2} sx={{ mt: 0.75 }}>
                    <TextField
                      select
                      name="expected_level_score"
                      label="Expected level *"
                      fullWidth
                      required
                      size="small"
                      sx={textFieldSx}
                      SelectProps={{ native: true }}
                      defaultValue={levels[0]?.score ?? 1}
                    >
                      {levels.map((l) => (
                        <option
                          key={l.id}
                          value={l.score}
                        >{`${l.name} (${l.score})`}</option>
                      ))}
                    </TextField>
          
                  </Stack>
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  className="theme-button"
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    mt: 0.5,
                  }}
                >
                  Save
                </Button>
              </Stack>
            </form>
          )}

          {drawer === "bulk" && (
            <Box className="space-y-2">
              <Typography variant="body2" color="text.secondary">
                Columns must match:{" "}
                <code>{REQUIRED_HEADERS.join(", ")}</code>
                <br />
                Categories allowed:{" "}
                <code>technical</code>, <code>functional</code>,{" "}
                <code>behavioral</code>
              </Typography>
              <Button
                onClick={makeTemplateCsv}
                variant="contained"
                className="theme-button"
                sx={{ textTransform: "none", fontWeight: 700, mt: 1 }}
              >
                <FiDownload style={{ marginRight: 8 }} /> Download template
              </Button>

              <Button
                component="label"
                variant="outlined"
                sx={{ textTransform: "none", mt: 0.5 }}
              >
                <FiUpload style={{ marginRight: 8 }} /> Choose CSV
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
                <Typography
                  variant="body2"
                  color="error"
                  sx={{ mt: 1 }}
                >
                  {(error as any)?.message || "Failed to load role skills."}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
