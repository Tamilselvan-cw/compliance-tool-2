// src/pages/organization/org/competency_matrix/CompetencyMatrixAnalyticsOrgWise.tsx
import * as React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  TextField,
  Tooltip,
  LinearProgress,
} from "@mui/material";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "../../../../api/axiosInstance";
import { LEVELS as LEVELS_FALLBACK } from "../../surveys/surveysStore";

/* ---------------- Types (same as original) ---------------- */

type ApiLevel = {
  id: string;
  name: string;
  score: number;
  description?: string | null;
};

type ApiDepartment = {
  id: string;
  name: string;
};

type ApiEmployee = {
  id: string;
  name: string;
  email?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  primary_role_id?: string | null;
  primary_role_title?: string | null;
};

type ApiCompetencyRole = {
  role_id: string;
  expected_level: number | null;
};

type ApiCompetency = {
  id: string;
  competency_name: string;
  category?: string | null;
  roles?: ApiCompetencyRole[]; // from backend
};

type ApiCell = {
  employee_id: string;
  competency_id: string;
  role_id?: string | null;
  current_level: number | null;
  expected_level: number | null;
  remarks?: string | null;
};

type ApiRoleExpectation = {
  role_id: string;
  competency_id: string;
  expected_level: number | null;
};

type SkillMatrixResponse = {
  org_id: string;
  survey_id: string;
  title?: string | null;
  levels: ApiLevel[];
  departments: ApiDepartment[];
  employees: ApiEmployee[];
  competencys: ApiCompetency[];
  cells: ApiCell[];
  role_expectations?: ApiRoleExpectation[];
};

type MatrixCell = {
  current: number | null;
  expected: number | null;
  remarks?: string | null;
};

type MatrixMap = Record<string, Record<string, MatrixCell>>; // employee_id -> competency_id -> cell

type EmployeeMeta = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
  primary_role_id?: string | null;
};

type SkillMeta = {
  id: string;
  name: string;
  category?: "technical" | "functional" | "behavioral" | string;
  roles: ApiCompetencyRole[];
};

/* ---------------- UI helpers (same) ---------------- */

function LegendDot({ color }: { color: string }) {
  return (
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: color,
      }}
    />
  );
}

const GAP_LEGEND = [
  { label: "No data", color: "rgba(148,163,184,0.35)" },
  { label: "No target defined", color: "#6b7280" },
  { label: "Gap > 1 level", color: "#ef4444" },
  { label: "Gap = 1 level", color: "#f97316" },
  { label: "On target", color: "#bbf7d0" },
  { label: "Above target", color: "#16a34a" },
];

const CATEGORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "technical", label: "Technical" },
  { id: "functional", label: "Functional" },
  { id: "behavioral", label: "Behavioral" },
] as const;
type CategoryFilterId = (typeof CATEGORY_FILTERS)[number]["id"];

type GapMeta = {
  color: string;
  status: "empty" | "no-target" | "gap" | "match" | "above";
  label: string;
};

function getGapMeta(
  current: number | null | undefined,
  expected: number | null | undefined
): GapMeta {
  if (current == null) {
    return { color: "rgba(148,163,184,0.35)", status: "empty", label: "No data" };
  }
  if (expected == null) {
    return {
      color: "#6b7280",
      status: "no-target",
      label: `Current ${current}, expected not defined`,
    };
  }
  const diff = current - expected;
  if (diff < -1) {
    return {
      color: "#ef4444",
      status: "gap",
      label: `Below target (current ${current}, expected ${expected}, gap ${Math.abs(
        diff
      )} levels)`,
    };
  }
  if (diff === -1) {
    return {
      color: "#f97316",
      status: "gap",
      label: `Slight gap (current ${current}, expected ${expected}, gap 1 level)`,
    };
  }
  if (diff === 0) {
    return { color: "#bbf7d0", status: "match", label: `On target (current ${current}, expected ${expected})` };
  }
  return { color: "#16a34a", status: "above", label: `Above target (current ${current}, expected ${expected}, +${diff} level${diff === 1 ? "" : "s"})` };
}

function DotBubble({ color, empty }: { color: string; empty: boolean }) {
  if (empty) {
    return (
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px dashed rgba(148,163,184,0.6)",
          bgcolor: "transparent",
        }}
      />
    );
  }
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        bgcolor: color,
        boxShadow: "0 0 0 2px rgba(255,255,255,0.9)",
      }}
    />
  );
}

function NotApplicableBubble() {
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: "1px dashed rgba(148,163,184,0.7)",
        bgcolor: "rgba(249,250,251,0.9)",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "&::before": {
            content: '""',
            width: 12,
            height: 1.5,
            bgcolor: "rgba(148,163,184,0.9)",
            transform: "rotate(-45deg)",
          },
        }}
      />
    </Box>
  );
}

function HeaderSkeleton() {
  return (
    <Box className="glass rounded-2xl" sx={{ p: 2, minHeight: 260, display: "flex", flexDirection: "column" }}>
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="30%" height={20} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={32} sx={{ borderRadius: 999, mb: 1 }} />
      <Skeleton variant="rectangular" height={32} sx={{ borderRadius: 999, mb: 2 }} />
      <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
    </Box>
  );
}

/* ------------ API fetcher (same as original) ------------ */

async function fetchSkillMatrix(orgId: string, surveyId: string): Promise<SkillMatrixResponse | null> {
  if (!orgId || !surveyId) return null;
  const res = await axios.get<SkillMatrixResponse>(`/organizations/${orgId}/surveys/${surveyId}/skill-matrix`);
  return res.data;
}

type UpdateCellPayload = {
  orgId: string;
  surveyId: string;
  employeeId: string;
  competencyId: string;
  roleId?: string | null;
  currentLevel: number;
  remarks?: string;
};

async function updateSkillCell(payload: UpdateCellPayload) {
  const { orgId, surveyId, employeeId, competencyId, roleId, currentLevel, remarks } = payload;
  const body = {
    employee_id: employeeId,
    competency_id: competencyId,
    role_id: roleId ?? null,
    current_level: currentLevel,
    remarks: remarks ?? null,
  };
  const res = await axios.post(`/organizations/${orgId}/surveys/${surveyId}/skill-matrix/cell`, body);
  return res.data;
}

/* ---------------- Main component: patched to accept props ---------------- */

/**
 * Now accepts optional props { orgId?: string; surveyId?: string }.
 * If props are not provided, falls back to useParams() so the route usage keeps working.
 */
export default function CompetencyMatrixAnalyticsOrgWise(props?: { orgId?: string; surveyId?: string }) {
  const params = useParams();
  const orgId = props?.orgId ?? (params.orgId ?? "");
  const surveyId = props?.surveyId ?? (params.surveyId ?? "");

  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilterId>("all");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [employeeQuery, setEmployeeQuery] = React.useState<string>("");

  const [editCell, setEditCell] = React.useState<any | null>(null);
  const [editLevel, setEditLevel] = React.useState<string>("");
  const [editRemarks, setEditRemarks] = React.useState<string>("");

  const queryClient = useQueryClient();

  const { data: matrixData, isLoading, isFetching, isError } = useQuery<SkillMatrixResponse | null>({
    queryKey: ["skill-matrix", orgId, surveyId],
    queryFn: () => fetchSkillMatrix(orgId, surveyId),
    enabled: !!orgId && !!surveyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: updateSkillCell,
    onSuccess: () => {
      setEditCell(null);
      queryClient.invalidateQueries({ queryKey: ["skill-matrix", orgId, surveyId] });
    },
  });

  const showFirstLoadSkeleton = isLoading && !matrixData;

  if (showFirstLoadSkeleton) {
    return (
      <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", minHeight: "60vh" }}>
        <HeaderSkeleton />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography sx={{ color: "var(--color-text-2)" }}>Failed to load skill matrix.</Typography>
      </Box>
    );
  }

  if (!matrixData) {
    return (
      <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography sx={{ color: "var(--color-text-2)" }}>No competency matrix data available.</Typography>
      </Box>
    );
  }

  const { title, levels: apiLevels, departments: apiDepartments, employees: apiEmployees, competencys: apiCompetencys, cells, role_expectations } = matrixData;
  const apiRoleExpectations: ApiRoleExpectation[] = role_expectations ?? [];

  const levelsForLegend: ApiLevel[] = apiLevels && apiLevels.length ? apiLevels : LEVELS_FALLBACK.map((l) => ({ id: l.id, name: l.name, score: l.score }));

  const employees: EmployeeMeta[] = apiEmployees.map((e) => ({
    id: e.id,
    name: e.name || `User ${e.id.slice(0, 6)}`,
    role: e.primary_role_title || undefined,
    department: e.department_name || undefined,
    email: e.email || undefined,
    primary_role_id: e.primary_role_id,
  }));

  const skills: SkillMeta[] = apiCompetencys.map((s) => ({ id: s.id, name: s.competency_name, category: (s.category as any) || "technical", roles: s.roles ?? [] }));

  const departmentOptions: string[] = apiDepartments && apiDepartments.length ? apiDepartments.map((d) => d.name) : Array.from(new Set(employees.map((e) => e.department).filter((v): v is string => !!v && v.trim().length > 0)));

  const matrix: MatrixMap = {};
  cells.forEach((c) => {
    if (!matrix[c.employee_id]) matrix[c.employee_id] = {};
    matrix[c.employee_id][c.competency_id] = { current: c.current_level, expected: c.expected_level, remarks: c.remarks ?? undefined };
  });

  const roleExpectationMap: Record<string, { expected_level: number | null }> = {};
  apiRoleExpectations.forEach((r) => {
    const key = `${r.role_id}::${r.competency_id}`;
    roleExpectationMap[key] = { expected_level: r.expected_level };
  });

  const q = employeeQuery.trim().toLowerCase();

  const visibleEmployees = employees.filter((e) => {
    if (departmentFilter !== "all") {
      const dept = e.department || "";
      if (dept !== departmentFilter) return false;
    }
    if (q) {
      const hay = `${e.name ?? ""} ${e.role ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const visibleSkills = skills.filter((s) => {
    if (categoryFilter === "all") return true;
    const cat = (s.category || "").toLowerCase();
    return cat === categoryFilter;
  });

  const totalCells = visibleSkills.length * (visibleEmployees.length || 1) || 1;
  let nonEmptyCells = 0;
  visibleEmployees.forEach((emp) => {
    const row = matrix[emp.id] || {};
    visibleSkills.forEach((sk) => {
      const cell = row[sk.id];
      if (cell && cell.current != null && cell.current > 0) nonEmptyCells += 1;
    });
  });
  const coveragePct = Math.round((nonEmptyCells / totalCells) * 100);
  const countsText = `${visibleEmployees.length} participant${visibleEmployees.length === 1 ? "" : "s"} · ${visibleSkills.length} competencies visible · Coverage ${coveragePct}%`;

  const levelNameFromScore = (score: number | null): string => {
    if (score == null) return "—";
    const found = levelsForLegend.find((l) => l.score === score);
    if (found) return `${found.name}`;
    return `Level ${score}`;
  };

  const openEditDialog = (emp: EmployeeMeta, sk: SkillMeta, cell: MatrixCell | undefined, expectedFromRole: number | null) => {
    const current = cell?.current ?? null;
    const expected = (cell?.expected ?? null) ?? expectedFromRole ?? null;
    setEditCell({
      open: true,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeRole: emp.role,
      competencyId: sk.id,
      competencyName: sk.name,
      current,
      expected,
      remarks: cell?.remarks,
      roleId: emp.primary_role_id,
    });
    setEditLevel(current != null ? String(current) : "");
    setEditRemarks(cell?.remarks ?? "");
  };

  const closeEditDialog = () => {
    if (mutation.isPending) return;
    setEditCell(null);
  };

  const handleSaveEdit = () => {
    if (!editCell) return;
    const lvlNum = Number(editLevel);
    if (!Number.isFinite(lvlNum) || lvlNum < 1 || lvlNum > 10) {
      alert("Please enter a level between 1 and 10.");
      return;
    }
    mutation.mutate({
      orgId: orgId,
      surveyId: surveyId,
      employeeId: editCell.employeeId,
      competencyId: editCell.competencyId,
      roleId: editCell.roleId ?? undefined,
      currentLevel: lvlNum,
      remarks: editRemarks.trim() || undefined,
    });
  };

  return (
    <Box sx={{ width: "100%", minHeight: "60vh", position: "relative" }}>
      {isFetching && <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 }}><LinearProgress /></Box>}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}>
        <Box className="glass rounded-2xl" sx={{ p: 2, border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>{title || "Competency Matrix"}</Typography>
            <Typography variant="body2" sx={{ color: "var(--color-text-2)" }}>{countsText}</Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ display: "block", fontWeight: 600, color: "var(--color-text-2)", mb: 0.5 }}>Levels :</Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              {levelsForLegend.map((l) => (
                <Chip key={l.id} size="small" label={`${l.name} (${l.score})`} sx={{ bgcolor: "rgba(255,255,255,0.9)", border: "1px solid rgba(148,163,184,0.35)", height: 22, borderRadius: 999, px: 0.75, "& .MuiChip-label": { fontSize: "11px !important", fontWeight: 500, padding: 0 } }} />
              ))}
            </Stack>
          </Box>

          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ display: "block", fontWeight: 600, color: "var(--color-text-2)", mb: 0.5 }}>Color Palette:</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              {GAP_LEGEND.map((item) => (
                <Stack key={item.label} direction="row" spacing={0.5} alignItems="center">
                  <LegendDot color={item.color} />
                  <Typography sx={{ fontSize: 12 }}>{item.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Box>

        <Box className="glass rounded-2xl" sx={{ p: 2, border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>Filters</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}>
            <ToggleButtonGroup size="small" value={categoryFilter} exclusive onChange={(_, v) => v && setCategoryFilter(v)} sx={{ borderRadius: 999, background: "rgba(255,255,255,0.9)", "& .MuiToggleButton-root": { textTransform: "none", fontSize: 12, px: 1.8 } }}>
              {CATEGORY_FILTERS.map((f) => <ToggleButton key={f.id} value={f.id}>{f.label}</ToggleButton>)}
            </ToggleButtonGroup>

            <Select size="small" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} displayEmpty sx={{ minWidth: 150, fontSize: 13, bgcolor: "rgba(255,255,255,0.9)", "& .MuiSelect-select": { py: 0.75 } }}>
              <MenuItem value="all"><em>All departments</em></MenuItem>
              {departmentOptions.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </Stack>

          <TextField size="small" placeholder="Search employee or role" value={employeeQuery} onChange={(e) => setEmployeeQuery(e.target.value)} sx={{ mt: 0.5, bgcolor: "rgba(255,255,255,0.9)", "& .MuiInputBase-input": { fontSize: 13, py: 0.75 } }} />
        </Box>
      </Box>

      <Box className="glass rounded-2xl" sx={{ p: 2, borderRadius: "var(--radius-2xl, 24px)", border: "1px solid var(--color-border)", overflowX: "auto" }}>
        {visibleEmployees.length === 0 || visibleSkills.length === 0 ? (
          <Box sx={{ minHeight: 200, display: "grid", placeItems: "center" }}>
            <Typography sx={{ color: "var(--color-text-2)" }}>No data available for the current filters.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: `220px repeat(${visibleEmployees.length || 1}, 90px)`, rowGap: 1.5, columnGap: 4, alignItems: "center", justifyContent: "flex-start", width: "fit-content", minWidth: "100%" }}>
            <Box />
            {visibleEmployees.map((emp) => (
              <Tooltip key={emp.id} arrow placement="top" title={<Box sx={{ display: "flex", flexDirection: "column" }}><Typography sx={{ fontWeight: 600, fontSize: 12 }}>{emp.name}</Typography></Box>}>
                <Box sx={{ justifySelf: "start", width: 60, height: 110, borderRadius: 999, border: "1px dashed rgba(148,163,184,0.7)", bgcolor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", px: 0.25 }}>
                  <Box sx={{ transform: "rotate(-90deg)", transformOrigin: "center", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", maxWidth: "90px", overflow: "hidden" }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 10, lineHeight: 1.1, color: "var(--color-text)", maxWidth: 55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>
                      {emp.name}
                    </Typography>
                  </Box>
                </Box>
              </Tooltip>
            ))}

            {visibleSkills.map((sk) => (
              <React.Fragment key={sk.id}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: "999px", border: "1px solid rgba(148,163,184,0.35)", bgcolor: "rgba(255,255,255,0.9)", display: "grid", placeItems: "center", fontSize: 12 }}>
                    {sk.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }} title={sk.name}>{sk.name}</Typography>
                    {sk.category && <Typography variant="caption" sx={{ color: "var(--color-text-2)", textTransform: "capitalize" }}>{sk.category}</Typography>}
                  </Box>
                </Box>

                {visibleEmployees.map((emp) => {
                  const row = matrix[emp.id] || {};
                  const cell = row[sk.id];
                  const empRoleId = emp.primary_role_id || null;
                  const competencyRoles = sk.roles || [];
                  const relevantForEmployee = !!empRoleId && competencyRoles.some((cr) => cr.role_id === empRoleId);
                  if (!relevantForEmployee) {
                    const hasData = cell && cell.current != null && cell.current > 0;
                    return (
                      <Tooltip key={`${emp.id}-${sk.id}`} arrow title={<Box sx={{ p: 0.5 }}><Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.3 }}>{emp.name} – {sk.name}</Typography><Typography sx={{ fontSize: 11 }}>This competency is not defined for {emp.role || "this role"}. {hasData ? "Existing data is shown as read-only." : ""}</Typography></Box>}>
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", opacity: 0.4, cursor: "not-allowed" }}>
                          <NotApplicableBubble />
                        </Box>
                      </Tooltip>
                    );
                  }

                  const roleKey = empRoleId ? `${empRoleId}::${sk.id}` : undefined;
                  const roleExp = roleKey ? roleExpectationMap[roleKey] : null;
                  const current = cell?.current ?? null;
                  const expected = (cell?.expected ?? null) ?? (roleExp ? roleExp.expected_level : null);
                  const gapMeta = getGapMeta(current, expected);
                  const isEmpty = gapMeta.status === "empty";

                  const curText = current != null && Number.isFinite(current) ? levelNameFromScore(current) : "—";
                  const expText = expected != null && Number.isFinite(expected) ? levelNameFromScore(expected) : "—";
                  const extra = cell?.remarks && cell.remarks.trim().length > 0 ? `\nRemarks: ${cell.remarks}` : "";
                  const tooltipBody = (gapMeta.status !== "empty" ? `Current: ${curText} | Expected: ${expText}\n${gapMeta.label}` : `Current: ${curText} | Expected: ${expText}`) + extra;

                  return (
                    <Tooltip key={`${emp.id}-${sk.id}`} arrow title={<Box sx={{ p: 0.5 }}><Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.3 }}>{emp.name} – {sk.name}</Typography><Typography sx={{ fontSize: 11, whiteSpace: "pre-line" }}>{tooltipBody}</Typography></Box>}>
                      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }} onClick={() => openEditDialog(emp, sk, cell, expected ?? null)}>
                        <DotBubble color={gapMeta.color} empty={isEmpty} />
                      </Box>
                    </Tooltip>
                  );
                })}
              </React.Fragment>
            ))}
          </Box>
        )}
      </Box>

      <Dialog open={!!editCell} onClose={closeEditDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>Update Level</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          {editCell && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{editCell.employeeName}</Typography>
                {editCell.employeeRole && <Typography sx={{ fontSize: 12, color: "var(--color-text-2)" }}>{editCell.employeeRole}</Typography>}
              </Box>
              <Typography sx={{ fontSize: 12, color: "var(--color-text-2)" }}>Competency: <b>{editCell.competencyName}</b></Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Update current level:</Typography>
              <Stack direction="row" spacing={1}>
                <Select size="small" value={editLevel} onChange={(e) => setEditLevel(e.target.value)} displayEmpty sx={{ flex: 1, fontSize: 13 }}>
                  <MenuItem value=""><em>Select level</em></MenuItem>
                  {levelsForLegend.map((l) => <MenuItem key={l.id} value={String(l.score)}>{l.name}</MenuItem>)}
                </Select>

                <TextField label="Expected" size="small" value={levelNameFromScore(editCell.expected)} InputProps={{ readOnly: true }} sx={{ width: 170 }} />
              </Stack>

              <TextField label="Remarks" size="small" multiline minRows={2} value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeEditDialog} size="small" variant="text" disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSaveEdit} size="small" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? <CircularProgress size={18} /> : "Save"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
