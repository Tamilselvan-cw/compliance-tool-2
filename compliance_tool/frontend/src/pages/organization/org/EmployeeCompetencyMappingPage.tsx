// ---------------------------------------------------------
// src/pages/organization/org/EmployeeCompetencyMappingPage.tsx
// ---------------------------------------------------------
import * as React from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid/models";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "@/api/axiosInstance";
import { cn } from "../../../components/lib/utils";
import { toast } from "../../../components/hooks/use-toast";

// ---- app roles ----
const ROLE_OPTIONS = ["employee", "org_hr", "org_admin", "org_manager"] as const;
export type AppRole = (typeof ROLE_OPTIONS)[number];

// ---- basic types ----
type OrgUser = {
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
};

type JobRole = {
  id: string;
  title?: string;
  name?: string;
};

type LevelDef = {
  id: string;
  name: string;
  score: number;
  description?: string | null;
};

const CATEGORY_SET = [
  { id: "technical", name: "Technical" },
  { id: "functional", name: "Functional" },
  { id: "behavioral", name: "Behavioral" },
] as const;
type CatId = (typeof CATEGORY_SET)[number]["id"];

type RoleCompetencyApi = {
  id: string;
  role_id: string;
  competency_id: string;
  expected_level: number;
  competency?: {
    id: string;
    name: string;
    category: CatId;
    description?: string | null;
  };
};

type EmployeeRoleSkillApi = {
  id: string;
  employee_id: string;
  role_id: string;
  competency_id: string;
  current_level: number;
  remarks?: string | null;
};

type EmployeeCompRow = {
  key: string;
  role_id: string;
  role_name: string;
  competency_id: string;
  competency_name: string;
  category: CatId;
  expected_level: number;
  employee_level: number | null;
  remarks: string;
};

type PageQuery = {
  employees: OrgUser[];
  roles: JobRole[];
  levels: LevelDef[];
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

const roleDisplayName = (r?: JobRole | null) =>
  (r?.title ?? r?.name ?? "").trim();

/* ------------------------------
   Fetch base data for page
------------------------------ */
async function fetchPageData(orgId: string): Promise<PageQuery> {
  const [empRes, rolesRes, levelsRes] = await Promise.all([
    axios.get(`/organizations/${orgId}/employees`, {
      params: { page: 1, limit: 500 },
    }),
    axios.get<{ items: JobRole[] }>(`/organizations/${orgId}/roles`, {
      params: { page: 1, limit: 200 },
    }),
    axios.get<{ items: LevelDef[] }>(`/organizations/${orgId}/levels`, {
      params: { only_active: true, page: 1, limit: 100 },
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

    department_id: emp.department_id ?? emp.department?.id ?? null,
    primary_role_id: emp.primary_role_id ?? emp.primary_role?.id ?? null,
    secondary_role_id: emp.secondary_role_id ?? emp.secondary_role?.id ?? null,
    created_at: emp.created_at,
  }));

  const roles =
    (rolesRes.data as any)?.items ??
    (Array.isArray(rolesRes.data) ? (rolesRes.data as any) : []);

  const levels = levelsRes.data.items ?? [];

  return { employees, roles, levels };
}

/* ------------------------------
   Main Component
------------------------------ */
export default function EmployeeCompetencyMappingPage() {
  const { orgId } = useParams();
  const [currentRole, setCurrentRole] = React.useState<AppRole | null>(null);
  const [currentManagerId, setCurrentManagerId] = React.useState<string | null>(
    null
  );

  // ---- who am I? ----
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const roleFromStorage =
        window.localStorage.getItem("app_role") ||
        window.localStorage.getItem("role") ||
        window.localStorage.getItem("user_role");
      
      console.log("roleFromStorage: ", roleFromStorage);

      const role = (roleFromStorage || "").toLowerCase() as AppRole;
      if (ROLE_OPTIONS.includes(role)) {
        setCurrentRole(role);
      } else {
        setCurrentRole("employee");
      }

      const fromEmployee =
        window.localStorage.getItem("employee_id") ||
        window.localStorage.getItem("emp_id");
      const fromUser = window.localStorage.getItem("user_id");
      setCurrentManagerId(fromEmployee || fromUser || null);
    } catch {
      setCurrentRole("employee");
      setCurrentManagerId(null);
    }
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery<PageQuery>({
    queryKey: ["employee-comp-mapping", orgId],
    queryFn: () => fetchPageData(orgId as string),
    enabled: !!orgId,
  });

  const employees = data?.employees ?? [];
  const roles = data?.roles ?? [];
  const levels = data?.levels ?? [];

  // ---- filter employees based on current role ----
  const visibleEmployees = React.useMemo(() => {
    if (!currentRole) return employees;

    if (currentRole === "org_hr" || currentRole === "org_admin") {
      return employees;
    }

    if (currentRole === "org_manager" && currentManagerId) {
      return employees.filter((e) => e.manager_id === currentManagerId);
    }

    // employees & others should not see this page ideally
    return [];
  }, [currentRole, currentManagerId, employees]);

  // ---- selected employee ----
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (visibleEmployees.length && !selectedEmployeeId) {
      setSelectedEmployeeId(visibleEmployees[0].id);
    }
  }, [visibleEmployees, selectedEmployeeId]);

  const selectedEmployee = React.useMemo(
    () => visibleEmployees.find((e) => e.id === selectedEmployeeId) ?? null,
    [visibleEmployees, selectedEmployeeId]
  );

  // ---- competency rows for selected employee ----
  const [compRows, setCompRows] = React.useState<EmployeeCompRow[]>([]);
  const [compLoading, setCompLoading] = React.useState(false);

  // map level score -> level name
  const levelScoreNameMap = React.useMemo(() => {
    const m = new Map<number, string>();
    levels.forEach((l) => m.set(l.score, l.name));
    return m;
  }, [levels]);

  const updateCompLevel = React.useCallback(
    (key: string, levelScore: number | null) => {
      setCompRows((prev) =>
        prev.map((row) =>
          row.key === key ? { ...row, employee_level: levelScore } : row
        )
      );
    },
    []
  );

  const updateCompRemarks = React.useCallback((key: string, value: string) => {
    setCompRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, remarks: value } : row))
    );
  }, []);

  // ---- load competencies when employee changes ----
  React.useEffect(() => {
    const loadForEmployee = async () => {
      if (!orgId || !selectedEmployee || !levels.length) {
        setCompRows([]);
        return;
      }

      const primaryRoleId = selectedEmployee.primary_role_id;
      const secondaryRoleId = selectedEmployee.secondary_role_id;

      if (!primaryRoleId && !secondaryRoleId) {
        setCompRows([]);
        return;
      }

      setCompLoading(true);
      try {
        // 1) existing skills
        const ersRes = await axios.get<{ items: EmployeeRoleSkillApi[] }>(
          `/organizations/${orgId}/employees/${selectedEmployee.id}/role-competency`
        );
        const existingSkills: EmployeeRoleSkillApi[] = ersRes.data.items ?? [];

        // helper
        const rows: EmployeeCompRow[] = [];
        const addRoleComps = async (roleId: string | undefined | null) => {
          if (!roleId) return;
          const res = await axios.get<{ items: RoleCompetencyApi[] }>(
            `/organizations/${orgId}/roles/${roleId}/competencys`
          );
          const items = res.data.items ?? [];

          const roleMeta = roles.find((r) => r.id === roleId);
          const roleName = roleDisplayName(roleMeta) || "Role";

          for (const rc of items) {
            const comp = rc.competency;
            if (!comp) continue;

            const existing = existingSkills.find(
              (es) => es.role_id === roleId && es.competency_id === rc.competency_id
            );

            let existingLevel: number | null = null;
            if (existing) {
              const raw =
                (existing as any).current_level ??
                (existing as any).level ??
                null;
              if (raw !== null && raw !== undefined && raw !== "") {
                let num = Number(raw);
                if (!Number.isNaN(num)) {
                  existingLevel = num;
                }
              }
            }

            rows.push({
              key: `${selectedEmployee.id}-${roleId}-${rc.competency_id}`,
              role_id: roleId,
              role_name: roleName,
              competency_id: rc.competency_id,
              competency_name: comp.name,
              category: comp.category,
              expected_level: rc.expected_level,
              employee_level: existingLevel,
              remarks: existing?.remarks ?? "",
            });
          }
        };

        await addRoleComps(primaryRoleId);
        await addRoleComps(secondaryRoleId);

        setCompRows(rows);
      } catch (err: any) {
        toast({
          title: "Failed to load competencies",
          description:
            err?.response?.data?.detail || err?.message || "Please try again.",
          variant: "destructive" as any,
        });
        setCompRows([]);
      } finally {
        setCompLoading(false);
      }
    };

    loadForEmployee();
  }, [orgId, selectedEmployee, levels, roles]);

  // ---- save mapping for selected employee ----
  const [saving, setSaving] = React.useState(false);

  const handleSaveForEmployee = async () => {
    if (!orgId || !selectedEmployee) return;

    const items = compRows
      .filter((row) => row.employee_level != null)
      .map((row) => {
        const lvl = row.employee_level as number;
        return {
          role_id: row.role_id,
          competency_id: row.competency_id,
          level: lvl,
          current_level: lvl,
          remarks: row.remarks?.trim() || null,
          source: "manual" as const,
        };
      });

    if (!items.length) {
      toast({
        title: "No levels selected",
        description:
          "Set at least one competency level before saving for this employee.",
        variant: "destructive" as any,
      });
      return;
    }

    setSaving(true);
    try {
      await axios.post(`/organizations/${orgId}/employee-role-competency/bulk`, {
        employee_id: selectedEmployee.id,
        items,
      });

      toast({
        title: "Competency mapping saved",
        description: `Updated ${selectedEmployee.name}.`,
      });

      // soft refresh if you want to pull fresh later
      await refetch();
    } catch (err: any) {
      toast({
        title: "Save failed",
        description:
          err?.response?.data?.detail || err?.message || "Please try again.",
        variant: "destructive" as any,
      });
    } finally {
      setSaving(false);
    }
  };

  // ---- columns for employee list ----
  const empColumns = React.useMemo<GridColDef<OrgUser>[]>(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        minWidth: 160,
      },
      {
        field: "email",
        headerName: "Email",
        flex: 1,
        minWidth: 200,
      },
      {
        field: "org_role",
        headerName: "Role",
        flex: 1,
        minWidth: 160,
      },
      {
        field: "manager_user_name",
        headerName: "Reporting To",
        flex: 1,
        minWidth: 160,
      },
    ],
    []
  );

  if (isLoading || !data || !currentRole) {
    return (
      <Box sx={{ p: 2 }}>
        <CircularProgress size={20} />{" "}
        <Typography
          variant="body2"
          sx={{ ml: 1, display: "inline-block" }}
        >
          Loading competency mapping…
        </Typography>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">
          {(error as any)?.message || "Failed to load data."}
        </Typography>
      </Box>
    );
  }

  if (currentRole !== "org_hr" && currentRole !== "org_admin" && currentRole !== "org_manager") {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2">
          Only HR, Admin, or Managers can access competency mapping.
        </Typography>
      </Box>
    );
  }

  if (!visibleEmployees.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2">
          No employees found for competency mapping.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ m: 1.5, pr: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Competency Mapping
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.8fr" },
          gap: 2,
          alignItems: "stretch",
        }}
      >
        {/* LEFT: employees list filtered by role/manager */}
        <Box className={cn("glass-card rounded-2xl")} sx={{ p: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, mb: 1, textTransform: "uppercase" }}
          >
            Employees
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", mb: 1 }}>
            {currentRole === "org_hr" || currentRole === "org_admin"
              ? "All employees are listed."
              : "Only your direct reportees are listed."}
          </Typography>
          <Box sx={{ height: 480, mt: 1 }}>
           <DataGrid
  rows={visibleEmployees}
  columns={empColumns}
  getRowId={(r) => r.id}
  hideFooter
  onRowClick={(params) => setSelectedEmployeeId(params.row.id)}
  rowSelectionModel={
    (selectedEmployeeId ? [selectedEmployeeId] : []) as any
  }
/>

          </Box>
        </Box>

        {/* RIGHT: competency mapping for selected employee */}
        <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
          {!selectedEmployee ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Select an employee on the left to view competency mapping.
            </Typography>
          ) : (
            <>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={1.5}
              >
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, textTransform: "uppercase" }}
                  >
                    {selectedEmployee.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    {selectedEmployee.email}
                    {selectedEmployee.org_role
                      ? ` • ${selectedEmployee.org_role}`
                      : ""}
                  </Typography>
                </Box>
                <Chip
                  label={
                    selectedEmployee.primary_role_id
                      ? "Role assigned"
                      : "No role assigned"
                  }
                  size="small"
                  color={
                    selectedEmployee.primary_role_id ? "success" : "warning"
                  }
                  variant="outlined"
                />
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              {levels.length === 0 ? (
                <Typography variant="body2" color="error">
                  No levels configured. Configure levels first.
                </Typography>
              ) : !selectedEmployee.primary_role_id &&
                !selectedEmployee.secondary_role_id ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  This employee has no primary/secondary role assigned yet. Assign roles
                  first to enable competency mapping.
                </Typography>
              ) : compLoading ? (
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <CircularProgress size={18} />
                  <Typography
                    variant="body2"
                    sx={{ ml: 1, display: "inline-block" }}
                  >
                    Loading competencies…
                  </Typography>
                </Box>
              ) : compRows.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No competencies found for this employee’s roles.
                </Typography>
              ) : (
                <>
                  {/* Level legend */}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mb: 1, flexWrap: "wrap" }}
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

                  <Divider sx={{ my: 1.5 }} />

                  {CATEGORY_SET.map((cat) => {
                    const rows = compRows.filter(
                      (r) => r.category === cat.id
                    );
                    if (!rows.length) return null;

                    return (
                      <Box key={cat.id} sx={{ mb: 2.5 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, mb: 1 }}
                        >
                          {cat.name}
                        </Typography>

                        {/* header row */}
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1.5fr 0.7fr 0.7fr 1fr",
                              sm: "2fr 0.7fr 0.8fr 1.2fr",
                            },
                            gap: 1,
                            mb: 0.5,
                            px: 1,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, color: "text.secondary" }}
                          >
                            Competency (Role)
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, color: "text.secondary" }}
                          >
                            Expected
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, color: "text.secondary" }}
                          >
                            Current
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, color: "text.secondary" }}
                          >
                            Remarks
                          </Typography>
                        </Box>

                        {/* data rows */}
                        <Stack spacing={0.75}>
                          {rows.map((row) => {
                            const expectedName = levelScoreNameMap.get(
                              row.expected_level
                            );
                            return (
                              <Box
                                key={row.key}
                                sx={{
                                  display: "grid",
                                  gridTemplateColumns: {
                                    xs: "1.5fr 0.7fr 0.7fr 1fr",
                                    sm: "2fr 0.7fr 0.8fr 1.2fr",
                                  },
                                  gap: 1,
                                  alignItems: "center",
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                  "&:nth-of-type(odd)": {
                                    backgroundColor: "rgba(255,255,255,0.4)",
                                  },
                                }}
                              >
                                {/* competency name + role */}
                                <Box>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    {row.competency_name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: "text.secondary" }}
                                  >
                                    Role: {row.role_name}
                                  </Typography>
                                </Box>

                                {/* expected level */}
                                <Typography variant="body2">
                                  {expectedName
                                    ? `${expectedName} (${row.expected_level})`
                                    : row.expected_level}
                                </Typography>

                                {/* current level select */}
                                <TextField
                                  select
                                  label=""
                                  size="small"
                                  sx={{ ...textFieldSx }}
                                  value={
                                    row.employee_level != null
                                      ? row.employee_level
                                      : ""
                                  }
                                  onChange={(e) =>
                                    updateCompLevel(
                                      row.key,
                                      e.target.value
                                        ? Number(e.target.value)
                                        : null
                                    )
                                  }
                                >
                                  <MenuItem value="">Not set</MenuItem>
                                  {levels.map((l) => (
                                    <MenuItem key={l.id} value={l.score}>
                                      {l.name} ({l.score})
                                    </MenuItem>
                                  ))}
                                </TextField>

                                {/* remarks */}
                                <TextField
                                  size="small"
                                  placeholder="Remarks"
                                  sx={textFieldSx}
                                  value={row.remarks}
                                  onChange={(e) =>
                                    updateCompRemarks(row.key, e.target.value)
                                  }
                                />
                              </Box>
                            );
                          })}
                        </Stack>
                      </Box>
                    );
                  })}

                  {/* Save button for this employee */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      mt: 1,
                    }}
                  >
                    <Button
                      variant="contained"
                      className="theme-button"
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        px: 3,
                        py: 1.1,
                      }}
                      onClick={handleSaveForEmployee}
                      disabled={saving}
                    >
                      {saving
                        ? "Saving…"
                        : "Save competency mapping for this employee"}
                    </Button>
                  </Box>
                </>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
