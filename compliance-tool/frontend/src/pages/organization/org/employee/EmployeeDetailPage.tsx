// ---------------------------------------------------------
// src/pages/organization/org/EmployeeDetailPage.tsx
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
  Tooltip,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "@/api/axiosInstance";
import { toast } from "../../../../components/hooks/use-toast";
import { cn } from "../../../../components/lib/utils";

// ---- basic types ----
const ROLE_OPTIONS = ["employee", "hr", "admin", "manager"] as const;
export type AppRole = (typeof ROLE_OPTIONS)[number];

// friendly labels for roles
const ROLE_LABEL_MAP: Record<AppRole, string> = {
  employee: "Individual Contributor",
  hr: "SME",
  admin: "Leadership",
  manager: "People Manager",
};

type Department = { id: string; name: string };

type JobRole = {
  id: string;
  title?: string;
  name?: string;
  department_id?: string | null;
};

const roleDisplayName = (r?: JobRole | null) =>
  (r?.title ?? r?.name ?? "").trim();

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

type Employee = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: AppRole;
  employee_number?: string | null;
  department_id?: string | null;
  primary_role_id?: string | null;
  secondary_role_id?: string | null;
  manager_id?: string | null;
};

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

// existing mapping rows
type EmployeeRoleSkillApi = {
  id: string;
  employee_id: string;
  role_id: string;
  competency_id: string;
  current_level: number;
  remarks?: string | null;
};

type EmployeePageData = {
  departments: Department[];
  roles: JobRole[];
  levels: LevelDef[];
  employee: Employee | null;
  existingSkills: EmployeeRoleSkillApi[];
  allEmployees: { id: string; name: string; email: string }[];
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

type FieldErrors = {
  name?: string;
  email?: string;
  primaryDepartmentId?: string;
  primaryRoleId?: string;
  comp?: string;
};

type RoleDetails = {
  id: string;
  title?: string | null;
  job_descriptions?: string[] | null;
  job_specifications?: string[] | null;
  job_description?: string | null;
  job_specification?: string | null;
  description?: string | null;
  specification?: string | null;
};

// common textfield style
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

/* ------------------------------
   Fetch base data for page
------------------------------ */
async function fetchEmployeePage(
  orgId: string,
  employeeId?: string
): Promise<EmployeePageData> {
  const [depsRes, rolesRes, levelsRes, empRes, ersRes, allEmpRes] =
    await Promise.all([
      axios.get<{ items: Department[] }>(
        `/organizations/${orgId}/departments`,
        { params: { page: 1, limit: 200 } }
      ),
      axios.get<{ items: JobRole[] }>(`/organizations/${orgId}/roles`, {
        params: { page: 1, limit: 200 },
      }),
      axios.get<{ items: LevelDef[] }>(`/organizations/${orgId}/levels`, {
        params: { only_active: true, page: 1, limit: 100 },
      }),
      employeeId
        ? axios.get<{ employee: Employee }>(
            `/organizations/${orgId}/employees/${employeeId}`
          )
        : Promise.resolve(null as any),
      employeeId
        ? axios.get<{ items: EmployeeRoleSkillApi[] }>(
            `/organizations/${orgId}/employees/${employeeId}/role-competency`
          )
        : Promise.resolve(null as any),
      axios.get(`/organizations/${orgId}/employees`, {
        params: { page: 1, limit: 200 },
      }),
    ]);

  const departments =
    (depsRes.data as any)?.items ??
    (Array.isArray(depsRes.data) ? (depsRes.data as any) : []);
  const roles =
    (rolesRes.data as any)?.items ??
    (Array.isArray(rolesRes.data) ? (rolesRes.data as any) : []);
  const levels = (levelsRes.data as any)?.items ?? [];

  const employee = employeeId ? (empRes as any).data.employee ?? null : null;
  const existingSkills = employeeId ? (ersRes as any)?.data?.items ?? [] : [];

  const rawList: any[] = Array.isArray(allEmpRes.data)
    ? allEmpRes.data
    : Array.isArray((allEmpRes.data as any)?.items)
    ? (allEmpRes.data as any).items
    : [];

  const allEmployees = rawList.map((emp: any) => ({
    id: emp.id,
    name: emp.name,
    email: emp.email,
  }));

  return { departments, roles, levels, employee, existingSkills, allEmployees };
}

/* ------------------------------
   Component
------------------------------ */
export default function EmployeeDetailPage() {
  const { orgId, employeeId } = useParams();
  const navigate = useNavigate();
  const isNew = !employeeId;

  const { data, isLoading, isError, error, refetch } =
    useQuery<EmployeePageData>({
      queryKey: ["employee-detail", orgId, employeeId ?? "new"],
      queryFn: () => fetchEmployeePage(orgId as string, employeeId),
      enabled: !!orgId,
    });

  const [saving, setSaving] = React.useState(false);

  // Primary / secondary department + role states
  const [primaryDepartmentId, setPrimaryDepartmentId] = React.useState("");
  const [secondaryDepartmentId, setSecondaryDepartmentId] = React.useState("");

  const [primaryRoleId, setPrimaryRoleId] = React.useState("");
  const [secondaryRoleId, setSecondaryRoleId] = React.useState("");
  const [hasSecondary, setHasSecondary] = React.useState<"no" | "yes">("no");

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [accessRole, setAccessRole] = React.useState<AppRole>("employee");
  const [managerId, setManagerId] = React.useState("");
  const [compRows, setCompRows] = React.useState<EmployeeCompRow[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [employeeNumber, setEmployeeNumber] = React.useState("");

  const [primaryRoleDetails, setPrimaryRoleDetails] =
    React.useState<RoleDetails | null>(null);
  const [secondaryRoleDetails, setSecondaryRoleDetails] =
    React.useState<RoleDetails | null>(null);

  const departments = data?.departments ?? [];
  const roles = data?.roles ?? [];
  const levels = data?.levels ?? [];
  const employee = data?.employee ?? null;
  const existingSkills = data?.existingSkills ?? [];
  const allEmployees = data?.allEmployees ?? [];

  const primaryRoleMeta = React.useMemo(
    () => roles.find((r) => r.id === primaryRoleId) ?? null,
    [roles, primaryRoleId]
  );
  const secondaryRoleMeta = React.useMemo(
    () => roles.find((r) => r.id === secondaryRoleId) ?? null,
    [roles, secondaryRoleId]
  );

  // Map level score -> level name & description for expected/current columns
  const levelScoreNameMap = React.useMemo(() => {
    const m = new Map<number, string>();
    levels.forEach((l) => {
      m.set(l.score, l.name);
    });
    return m;
  }, [levels]);

  const levelScoreDescMap = React.useMemo(() => {
    const m = new Map<number, string>();
    levels.forEach((l) => {
      if (l.description) m.set(l.score, l.description);
    });
    return m;
  }, [levels]);

  // 🔹 helper to update current level for a competency row
  const updateCompLevel = React.useCallback(
    (key: string, levelScore: number | null) => {
      setCompRows((prev) =>
        prev.map((row) =>
          row.key === key ? { ...row, employee_level: levelScore } : row
        )
      );
      setFieldErrors((prev) => ({ ...prev, comp: undefined }));
    },
    []
  );

  const updateCompRemarks = (key: string, value: string) => {
    setCompRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, remarks: value } : row))
    );
  };

  // hydrate state when employee loaded
  React.useEffect(() => {
    if (!employee) return;
    setName(employee.name);
    setEmail(employee.email);
    setAccessRole(employee.role ?? "employee");
    setPrimaryDepartmentId(employee.department_id ?? "");
    setPrimaryRoleId(employee.primary_role_id ?? "");
    if (employee.secondary_role_id) {
      setHasSecondary("yes");
      setSecondaryRoleId(employee.secondary_role_id);
      // Note: we don't have a separate secondary department on the API; leave secondaryDepartmentId empty.
      // If your API exposes `secondary_department_id` you can set it here similarly.
    } else {
      setHasSecondary("no");
      setSecondaryRoleId("");
    }
    setManagerId(employee.manager_id ?? "");
    setEmployeeNumber(employee.employee_number ?? "");
  }, [employee]);

  // roles filtered by their own department selection
  const filteredRolesPrimary = React.useMemo(() => {
    if (!primaryDepartmentId) return roles;
    return roles.filter((r) => r.department_id === primaryDepartmentId);
  }, [primaryDepartmentId, roles]);

  const filteredRolesSecondary = React.useMemo(() => {
    if (!secondaryDepartmentId) return roles;
    return roles.filter((r) => r.department_id === secondaryDepartmentId);
  }, [secondaryDepartmentId, roles]);

  // when primary role is chosen first, auto-select its department (primary)
  React.useEffect(() => {
    if (!primaryRoleId) return;
    const role = roles.find((r) => r.id === primaryRoleId);
    if (role && role.department_id && role.department_id !== primaryDepartmentId) {
      setPrimaryDepartmentId(role.department_id);
    }
  }, [primaryRoleId, roles, primaryDepartmentId]);

  // when secondary role is chosen, auto-select its department (secondary)
  React.useEffect(() => {
    if (!secondaryRoleId) return;
    const role = roles.find((r) => r.id === secondaryRoleId);
    if (role && role.department_id && role.department_id !== secondaryDepartmentId) {
      setSecondaryDepartmentId(role.department_id);
    }
  }, [secondaryRoleId, roles, secondaryDepartmentId]);

  // fetch role competencies when primary / secondary roles change
  React.useEffect(() => {
    if (!orgId) return;
    if (!levels.length) return;

    const fetchRoleComps = async () => {
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

          // handle both current_level and level, and cast to number
          let existingLevel: number | null = null;
          if (existing) {
            const raw = (existing as any).current_level ?? (existing as any).level ?? null;
            if (raw !== null && raw !== undefined && raw !== "") {
              existingLevel = Number(raw);
              if (Number.isNaN(existingLevel)) {
                existingLevel = null;
              }
            }
          }

          rows.push({
            key: `${roleId}-${rc.competency_id}`,
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

      try {
        await addRoleComps(primaryRoleId);
        if (hasSecondary === "yes") {
          await addRoleComps(secondaryRoleId);
        }
        setCompRows(rows);
      } catch (err: any) {
        toast({
          title: "Failed to load competencies",
          description:
            err?.response?.data?.detail || err?.message || "Please try again.",
          variant: "destructive" as any,
        });
      }
    };

    if (primaryRoleId || (hasSecondary === "yes" && secondaryRoleId)) {
      fetchRoleComps();
    } else {
      setCompRows([]);
    }
  }, [orgId, primaryRoleId, secondaryRoleId, hasSecondary, levels, roles, existingSkills]);

  // fetch role details (JD/JS) when primary / secondary roles change
  React.useEffect(() => {
    if (!orgId || !primaryRoleId) {
      setPrimaryRoleDetails(null);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`/organizations/${orgId}/roles/${primaryRoleId}`);
        const role = (res.data as any).role ?? res.data;
        setPrimaryRoleDetails(role);
      } catch {
        setPrimaryRoleDetails(null);
      }
    })();
  }, [orgId, primaryRoleId]);

  React.useEffect(() => {
    if (!orgId || hasSecondary !== "yes" || !secondaryRoleId) {
      setSecondaryRoleDetails(null);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`/organizations/${orgId}/roles/${secondaryRoleId}`);
        const role = (res.data as any).role ?? res.data;
        setSecondaryRoleDetails(role);
      } catch {
        setSecondaryRoleDetails(null);
      }
    })();
  }, [orgId, hasSecondary, secondaryRoleId]);

  // render job description as bullets when job_descriptions array exists
  const renderJobDescription = (rd: RoleDetails | null) => {
    if (!rd) return null;

    // CASE 1: Array of job_descriptions → render as <ul> with bullet + "-" prefix
    if (Array.isArray(rd.job_descriptions) && rd.job_descriptions.length > 0) {
      return (
        <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 1 }}>
          {rd.job_descriptions!.map((item, idx) => (
            <li key={idx}>
              <Typography variant="body2" sx={{ display: "inline" }}>
                - {item}
              </Typography>
            </li>
          ))}
        </Box>
      );
    }

    // CASE 2: Single text description → split by lines and add "- "
    const raw = rd.job_description ?? rd.description ?? "";
    if (!raw) return null;

    const lines = raw
      .split("\n")
      .map((ln) => (ln.trim() ? `- ${ln.trim()}` : ""))
      .join("\n");

    return (
      <Typography variant="body2" sx={{ mb: 1, whiteSpace: "pre-line" }}>
        {lines}
      </Typography>
    );
  };

  // ---------- validation ----------
  const validateForm = React.useCallback((): boolean => {
    const errors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      errors.name = "Name must have at least 2 characters.";
    }

    if (!trimmedEmail) {
      errors.email = "Email is required.";
    }

    if (!primaryDepartmentId) {
      errors.primaryDepartmentId = "Select a department.";
    }

    if (!primaryRoleId) {
      errors.primaryRoleId = "Select a primary role.";
    }

    setFieldErrors(errors);
    const ok = Object.keys(errors).length === 0;

    if (!ok) {
      toast({
        title: "Please fix the highlighted fields",
        description: "Basic details and primary role are required before saving.",
        variant: "destructive" as any,
      });
    }

    return ok;
  }, [name, email, primaryDepartmentId, primaryRoleId]);

  const handleSave: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!orgId) return;

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: accessRole,
        // Save primary department as employee.department_id (keeps existing API shape)
        department_id: primaryDepartmentId || null,
        primary_role_id: primaryRoleId || null,
        secondary_role_id: hasSecondary === "yes" && secondaryRoleId ? secondaryRoleId : null,
        manager_id: managerId || null,
        employee_number: employeeNumber?.trim() || null,
      };

      let empId = employeeId || "";

      // 1) create / update employee
      if (isNew) {
        const res = await axios.post(`/organizations/${orgId}/employees`, payload);
        const d: any = res.data;
        empId =
          d?.id ?? d?.employee_id ?? d?.employee?.id ?? "";

        if (!empId) {
          toast({
            title: "Employee created (mapping skipped)",
            description:
              "We could not determine the new employee ID from the response, so competency mappings were not saved.",
            variant: "destructive" as any,
          });
        }
      } else {
        await axios.patch(`/organizations/${orgId}/employees/${employeeId}`, payload);
        empId = employeeId as string;
      }

      // 2) prepare competency mappings payload (optional)
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

      if (items.length > 0 && empId) {
        await axios.post(`/organizations/${orgId}/employee-role-competency/bulk`, {
          employee_id: empId,
          items,
        });
      }

      toast({
        title: isNew ? "Employee created" : "Employee updated",
        description: items.length ? "Details and competency mapping saved." : "Details saved.",
      });

      if (isNew) {
        navigate(`/org/${orgId}/organization/employees`, { replace: true });
      } else {
        await refetch();
      }
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.response?.data?.detail || err?.message || "Please try again.",
        variant: "destructive" as any,
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !data) {
    return (
      <Box sx={{ p: 2 }}>
        <CircularProgress size={20} />{" "}
        <Typography variant="body2" sx={{ ml: 1, display: "inline-block" }}>
          Loading employee…
        </Typography>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">
          {(error as any)?.message || "Failed to load employee."}
        </Typography>
      </Box>
    );
  }

  const getRoleJS = (rd: RoleDetails | null) => {
    if (!rd) return "";
    if (Array.isArray(rd.job_specifications) && rd.job_specifications.length > 0) {
      return rd.job_specifications.map((s) => `- ${s}`).join("\n");
    }
    const raw = rd.job_specification ?? rd.specification ?? "";
    if (!raw) return "";
    // Prefix each non-empty line with "- "
    return raw
      .split("\n")
      .map((ln) => (ln.trim() ? `- ${ln}` : ln))
      .join("\n");
  };

  return (
    <Box sx={{ m: 1.5, pr: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        {isNew ? "Add Employee" : "Employee Details"}
      </Typography>

      <form onSubmit={handleSave}>
        <Stack spacing={2.5}>
          {/* 1. BASIC DETAILS */}
          <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 1, textTransform: "uppercase" }}
            >
              Basic details
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="Full name"
                fullWidth
                required
                size="small"
                sx={textFieldSx}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                error={!!fieldErrors.name}
                helperText={fieldErrors.name}
              />
              <TextField
                label="Email"
                type="email"
                fullWidth
                required
                size="small"
                sx={textFieldSx}
                value={email}
                onChange={(e) => {
                  if (!isNew) return;
                  setEmail(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={!isNew}
                error={!!fieldErrors.email}
                helperText={
                  fieldErrors.email ||
                  (!isNew ? "Email cannot be edited for existing users." : "")
                }
              />

              {/* Employee number input */}
              <TextField
                label="Employee number"
                fullWidth
                size="small"
                sx={textFieldSx}
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                helperText="Custom employee identifier (optional)"
              />
            </Stack>
          </Box>

          {/* 2. ACCESS & ROLES */}
          <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 1, textTransform: "uppercase" }}
            >
              Role Details
            </Typography>
            <Stack spacing={1.5}>
              {/* Access role (app-level) */}
              <TextField
                select
                label="Access Role"
                fullWidth
                required
                size="small"
                sx={textFieldSx}
                value={accessRole}
                onChange={(e) => setAccessRole(e.target.value as AppRole)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {ROLE_LABEL_MAP[r]}
                  </MenuItem>
                ))}
              </TextField>

              {/* Primary department */}
              <TextField
                select
                label="Primary department"
                fullWidth
                required
                size="small"
                sx={textFieldSx}
                value={primaryDepartmentId}
                onChange={(e) => {
                  setPrimaryDepartmentId(e.target.value);
                  setPrimaryRoleId("");
                  setFieldErrors((prev) => ({ ...prev, primaryDepartmentId: undefined }));
                }}
                error={!!fieldErrors.primaryDepartmentId}
                helperText={fieldErrors.primaryDepartmentId}
              >
                <MenuItem value="">All departments</MenuItem>
                {departments.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </TextField>

              {/* Primary role */}
              <TextField
                select
                label="Primary role"
                fullWidth
                required
                size="small"
                sx={textFieldSx}
                value={primaryRoleId}
                onChange={(e) => {
                  setPrimaryRoleId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, primaryRoleId: undefined }));
                }}
                error={!!fieldErrors.primaryRoleId}
                helperText={fieldErrors.primaryRoleId}
              >
                {filteredRolesPrimary.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {roleDisplayName(r)}
                  </MenuItem>
                ))}
              </TextField>

              {/* Secondary role toggle */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={hasSecondary === "yes" ? "Has secondary role" : "No secondary role"}
                  size="small"
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setHasSecondary((prev) => (prev === "yes" ? "no" : "yes"))}
                >
                  {hasSecondary === "yes" ? "Remove secondary role" : "Add secondary role"}
                </Button>
              </Stack>

              {/* Secondary department + role (shown only when enabled) */}
              {hasSecondary === "yes" && (
                <>
                  <TextField
                    select
                    label="Secondary department"
                    fullWidth
                    size="small"
                    sx={textFieldSx}
                    value={secondaryDepartmentId}
                    onChange={(e) => {
                      setSecondaryDepartmentId(e.target.value);
                      setSecondaryRoleId("");
                    }}
                    helperText=""
                  >
                    <MenuItem value="">All departments</MenuItem>
                    {departments.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    label="Secondary role"
                    fullWidth
                    size="small"
                    sx={textFieldSx}
                    value={secondaryRoleId}
                    onChange={(e) => setSecondaryRoleId(e.target.value)}
                  >
                    {filteredRolesSecondary.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {roleDisplayName(r)}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}
            </Stack>
          </Box>

          {/* 3. REPORTING */}
          <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 1, textTransform: "uppercase" }}
            >
              Reporting
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                select
                label="Reporting To"
                fullWidth
                size="small"
                sx={textFieldSx}
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                {allEmployees.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email})
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Box>

          {/* Primary role box */}
          {primaryRoleDetails && (
            <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 1, textTransform: "uppercase" }}
              >
                Primary role details
              </Typography>

              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Role:</strong> {primaryRoleMeta ? roleDisplayName(primaryRoleMeta) : ""}
              </Typography>

              {renderJobDescription(primaryRoleDetails)}

              {getRoleJS(primaryRoleDetails) && (
                <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                  <strong>Job Specification:</strong>
                  {"\n"}
                  {getRoleJS(primaryRoleDetails)}
                </Typography>
              )}
            </Box>
          )}

          {/* Secondary role box */}
          {hasSecondary === "yes" && secondaryRoleDetails && (
            <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 1, textTransform: "uppercase" }}
              >
                Secondary role details
              </Typography>

              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Role:</strong> {secondaryRoleMeta ? roleDisplayName(secondaryRoleMeta) : ""}
              </Typography>

              {renderJobDescription(secondaryRoleDetails)}

              {getRoleJS(secondaryRoleDetails) && (
                <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                  <strong>Job Specification:</strong>
                  {"\n"}
                  {getRoleJS(secondaryRoleDetails)}
                </Typography>
              )}
            </Box>
          )}

          {/* 5. COMPETENCY MAPPING – TABLE */}
          <Box
            className={cn("glass-card rounded-2xl")}
            sx={{
              p: 2.5,
              borderColor: fieldErrors.comp ? "error.main" : "rgba(148,163,184,0.4)",
              borderWidth: fieldErrors.comp ? 1 : 0,
              borderStyle: fieldErrors.comp ? "solid" : "none",
            }}
          >
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: "uppercase" }}>
                  Competency mapping
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Based on primary / secondary roles – set employee level and remarks for each competency (optional).
                </Typography>
              </Box>
            </Stack>

            {levels.length === 0 ? (
              <Typography variant="body2" color="error">
                No levels configured. Configure levels first.
              </Typography>
            ) : compRows.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Select a primary (and optional secondary) role to load competencies.
              </Typography>
            ) : (
              <>
                {/* level legend */}
                <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }} alignItems="center">
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                    Levels:
                  </Typography>
                  {levels.map((l) => (
                    <Chip
                      key={l.id}
                      label={`${l.name}`}
                      size="small"
                      sx={{
                        bgcolor: "rgba(255,255,255,0.6)",
                        height: 22,
                        borderRadius: "999px",
                        border: "1px solid rgba(148,163,184,0.4)",
                        "& .MuiChip-label": { fontSize: 12, lineHeight: "18px", px: 1 },
                      }}
                    />
                  ))}
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                {CATEGORY_SET.map((cat) => {
                  const rows = compRows.filter((r) => r.category === cat.id);
                  if (!rows.length) return null;

                  return (
                    <Box key={cat.id} sx={{ mb: 2.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        {cat.name}
                      </Typography>

                      {/* header row */}
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1.5fr 0.7fr 0.7fr 1fr", sm: "2fr 0.7fr 0.8fr 1.2fr" }, gap: 1, mb: 0.5, px: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                          Competency (Role)
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                          Expected
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                          Current
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                          Remarks
                        </Typography>
                      </Box>

                      {/* data rows */}
                      <Stack spacing={0.75}>
                        {rows.map((row) => {
                          const expectedName = levelScoreNameMap.get(row.expected_level);
                          const expectedDesc = levelScoreDescMap.get(row.expected_level) ?? "";

                          return (
                            <Box
                              key={row.key}
                              sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1.5fr 0.7fr 0.7fr 1fr", sm: "2fr 0.7fr 0.8fr 1.2fr" },
                                gap: 1,
                                alignItems: "center",
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                "&:nth-of-type(odd)": { backgroundColor: "rgba(255,255,255,0.4)" },
                              }}
                            >
                              {/* competency name + role */}
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {row.competency_name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  Role: {row.role_name}
                                </Typography>
                              </Box>

                              {/* expected level with tooltip (hover shows description) */}
                              <Box>
                                <Tooltip title={expectedDesc || expectedName || ""} arrow>
                                  <Typography variant="body2" sx={{ cursor: expectedDesc ? "help" : "default" }}>
                                    {expectedName ?? row.expected_level}
                                  </Typography>
                                </Tooltip>
                              </Box>

                              {/* current level select + description shown when selected */}
                              <Box>
                                <TextField
                                  select
                                  label=""
                                  size="small"
                                  sx={{ ...textFieldSx, width: "100%" }}
                                  value={row.employee_level != null ? row.employee_level : ""}
                                  onChange={(e) =>
                                    updateCompLevel(row.key, e.target.value ? Number(e.target.value) : null)
                                  }
                                >
                                  <MenuItem value="">Not set</MenuItem>
                                  {levels.map((l) => (
                                    <MenuItem key={l.id} value={l.score}>
                                      <Tooltip
                                        title={l.description || ""}
                                        arrow
                                        placement="right"
                                        disableInteractive
                                      >
                                        {/* use a span/Box so Tooltip attaches to the text only */}
                                        <Box component="span" sx={{ display: "inline-block", width: "100%" }}>
                                          {l.name}
                                        </Box>
                                      </Tooltip>
                                    </MenuItem>
                                  ))}

                                </TextField>

                                {/* current level description */}
                              
                              </Box>

                              {/* remarks */}
                              <TextField
                                size="small"
                                placeholder="Remarks"
                                sx={textFieldSx}
                                value={row.remarks}
                                onChange={(e) => updateCompRemarks(row.key, e.target.value)}
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  );
                })}
              </>
            )}
          </Box>

          {/* ACTIONS */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1, gap: 2 }}>
            <Button variant="outlined" sx={{ textTransform: "none", fontWeight: 600 }} onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" className="theme-button" sx={{ textTransform: "none", fontWeight: 700, px: 3, py: 1.1 }} disabled={saving}>
              {saving ? "Saving…" : isNew ? "Save employee" : "Save changes"}
            </Button>
          </Box>
        </Stack>
      </form>
    </Box>
  );
}
