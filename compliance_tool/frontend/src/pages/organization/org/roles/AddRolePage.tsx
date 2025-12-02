/* Drop-in replacement file with:
   - corrected competency endpoints
   - duplicate-role pre-check + friendlier 409 handling
   - role-level description edits preserved
*/

import * as React from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  MenuItem,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "@/api/axiosInstance";
import { toast } from "../../../../components/hooks/use-toast";
import { cn } from "../../../../components/lib/utils";

type Department = {
  id: string;
  name: string;
  department_code?: string | null;
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

type CompetencyInput = {
  name: string;
  category: CatId;
  expected_level_score: number;
  description?: string;
  competency_code?: string;
  competency_id?: string; // optional canonical id from backend
  localTempId?: string; // internal local id for new rows
};

type JobType = "regular" | "hybrid" | "remote";
type EducationQual = "iti" | "diploma" | "bachelors" | "masters" | "others";

type RoleDetail = {
  id: string;
  title: string;
  department_id: string | null;
  experience_years?: number | null;
  job_descriptions?: string[];
  job_specifications?: string[];
  job_type?: JobType | null;
  education_qualification?: string | null;
  descriptions?: string[];
  specifications?: string[];
  role_code?: string | null;
};

type CompetencyApi = {
  id: string;
  role_id: string;
  competency_id: string;
  expected_level: number;
  created_at: string;
  updated_at: string;
  competency?: {
    id: string;
    name: string;
    category: CatId;
    description?: string | null;
    competency_code?: string | null;
  };
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

const SELECT_MENU_PROPS = {
  PaperProps: {
    style: {
      maxHeight: 360,
    },
  },
};

function padAtLeast3(arr: string[]): string[] {
  const copy = [...arr];
  while (copy.length < 3) copy.push("");
  return copy;
}

const JOB_TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

const EDUCATION_OPTIONS: { value: EducationQual; label: string }[] = [
  { value: "iti", label: "ITI" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelors", label: "Bachelors" },
  { value: "masters", label: "Masters" },
  { value: "others", label: "Others" },
];

import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";

function useDebounce(value: string, delay = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

type Suggestion = {
  id: string;
  name: string;
  competency_code?: string | null;
  category?: string | null;
  description?: string | null;
};

function AutocompleteSkill({
  value,
  onChange,
  orgId,
  category,
}: {
  value: CompetencyInput;
  onChange: (patch: Partial<CompetencyInput>) => void;
  orgId?: string | undefined;
  category?: CatId | undefined;
}) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<Suggestion[]>([]);
  const [inputVal, setInputVal] = React.useState(value.name ?? "");
  const debounced = useDebounce(inputVal, 300);
  const loading = open && debounced.length > 0;

  React.useEffect(() => {
    let cancelled = false;
    if (!orgId || !debounced.trim()) {
      setOptions([]);
      return;
    }
    (async () => {
      try {
        const params: any = { q: debounced, limit: 10, page: 1 };
        if (category) params.category = category;
        params.org_id = orgId;

        // corrected: GET /competencys
        const res = await axios.get<{ items: any[] }>(`/competencys/competencys`, { params });
        if (cancelled) return;

        const opts: Suggestion[] = (res.data.items ?? []).map((it) => ({
          id: it.id,
          name: it.name,
          competency_code: it.competency_code,
          category: it.category,
          description: it.description ?? "",
        }));

        setOptions(opts);

        const trimmed = debounced.trim();
        if (trimmed) {
          const match = opts.find(
            (o) => String(o.name).trim().toLowerCase() === trimmed.toLowerCase()
          );
          if (match) {
            if (value.competency_id !== match.id) {
              onChange({
                name: match.name,
                competency_id: match.id,
                competency_code: match.competency_code ?? undefined,
                description: match.description ?? "",
              });
              setInputVal(match.name);
            }
          }
        }
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, orgId, category]);

  React.useEffect(() => {
    setInputVal(value.name ?? "");
  }, [value.name]);

  const optionLabel = (opt: Suggestion | string) =>
    typeof opt === "string"
      ? opt
      : `${opt.name}${opt.competency_code ? " • " + opt.competency_code : ""}`;

  return (
    <Autocomplete
      freeSolo
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      getOptionLabel={(opt) => optionLabel(opt as any)}
      filterOptions={(opts) => opts}
      inputValue={inputVal}
      onInputChange={(_, v, reason) => {
        setInputVal(v);
        if (reason === "input") {
          onChange({ name: v, competency_id: undefined, competency_code: undefined, description: undefined });
        }
      }}
      onChange={(_, selected) => {
        if (!selected) {
          onChange({ name: "" });
          return;
        }
        if (typeof selected === "string") {
          onChange({ name: selected, competency_id: undefined, competency_code: undefined, description: undefined });
        } else {
          onChange({
            name: selected.name,
            competency_id: selected.id,
            competency_code: selected.competency_code ?? undefined,
            description: selected.description ?? "",
          });
        }
      }}
      sx={{ flex: 1, minWidth: 0 }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Skill name *"
          size="small"
          fullWidth
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            onChange({ name: e.target.value, competency_id: undefined, competency_code: undefined, description: undefined });
          }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

export default function AddRolePage() {
  const { orgId, roleId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!roleId;

  const [title, setTitle] = React.useState("");
  const [deptId, setDeptId] = React.useState("");
  const [expYears, setExpYears] = React.useState("");

  const [jobDescs, setJobDescs] = React.useState<string[]>(["", "", ""]);
  const [competencies, setCompetencies] = React.useState<CompetencyInput[]>(
    []
  );

  const [jobType, setJobType] = React.useState<JobType | "">("");
  const [educationQual, setEducationQual] = React.useState<
    EducationQual | ""
  >("");
  const [educationOtherText, setEducationOtherText] = React.useState("");

  const [saving, setSaving] = React.useState(false);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const [localDepartments, setLocalDepartments] = React.useState<Department[]>(
    []
  );
  const [addDeptOpen, setAddDeptOpen] = React.useState(false);
  const [newDeptName, setNewDeptName] = React.useState("");
  const [newDeptCode, setNewDeptCode] = React.useState("");
  const [addingDept, setAddingDept] = React.useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<{
    departments: Department[];
    levels: LevelDef[];
    role: RoleDetail | null;
    roleComps: CompetencyApi[];
  }>({
    queryKey: ["role-form-init", orgId, roleId],
    enabled: !!orgId,
    queryFn: async () => {
      if (!orgId) throw new Error("orgId missing");

      const [depsRes, levelsRes, roleRes, compsRes] = await Promise.all([
        axios.get<{ items: Department[] }>(
          `/organizations/${orgId}/departments`,
          { params: { page: 1, limit: 500 } }
        ),
        axios.get<{ items: LevelDef[] }>(`/organizations/${orgId}/levels`, {
          params: { only_active: true, page: 1, limit: 100 },
        }),
        roleId
          ? axios.get<RoleDetail>(`/organizations/${orgId}/roles/${roleId}`)
          : Promise.resolve(null as any),
        roleId
          ? axios.get<{ items: CompetencyApi[] }>(
              // corrected: fetch role competencies
              `/organizations/${orgId}/roles/${roleId}/competencys`
            )
          : Promise.resolve(null as any),
      ]);

      return {
        departments: depsRes.data.items ?? [],
        levels: levelsRes.data.items ?? [],
        role: roleId ? (roleRes as any)?.data ?? null : null,
        roleComps: roleId ? (compsRes as any)?.data?.items ?? [] : [],
      };
    },
  });

  const departments = data?.departments ?? [];
  const levels = data?.levels ?? [];
  const role = data?.role ?? null;
  const roleComps = data?.roleComps ?? [];

  React.useEffect(() => {
    setLocalDepartments(departments);
  }, [departments]);

  React.useEffect(() => {
    if (!role) return;

    setTitle(role.title ?? "");
    setDeptId(role.department_id ?? "");
    setExpYears(
      role.experience_years != null ? String(role.experience_years) : ""
    );

    const rawJd = role.job_descriptions ?? role.descriptions ?? [];
    const jd = padAtLeast3(rawJd);
    setJobDescs(jd);

    setJobType((role.job_type as JobType | null) ?? "");

    const rawEdu = (role.education_qualification || "").trim();
    const lowered = rawEdu.toLowerCase();

    const knownTokens: EducationQual[] = [
      "iti",
      "diploma",
      "bachelors",
      "masters",
      "others",
    ];

    if (!rawEdu) {
      setEducationQual("");
      setEducationOtherText("");
    } else if (
      knownTokens.includes(lowered as EducationQual) &&
      lowered !== "others"
    ) {
      setEducationQual(lowered as EducationQual);
      setEducationOtherText("");
    } else if (lowered === "others") {
      setEducationQual("others");
      setEducationOtherText("");
    } else {
      setEducationQual("others");
      setEducationOtherText(rawEdu);
    }
  }, [role]);

  React.useEffect(() => {
    if (!levels.length) return;

    if (roleComps.length) {
      const mapped: CompetencyInput[] = roleComps.map((rc) => ({
        name: rc.competency?.name ?? "",
        category: (rc.competency?.category as CatId) ?? "technical",
        expected_level_score: rc.expected_level,
        description: rc.competency?.description ?? undefined,
        competency_code: rc.competency?.competency_code ?? undefined,
        competency_id: rc.competency?.id ?? undefined,
      }));
      setCompetencies(mapped);
      return;
    }

    if (!isEdit && !roleComps.length) {
      setCompetencies([
        {
          name: "",
          category: "technical",
          expected_level_score: levels[0].score,
        },
        {
          name: "",
          category: "functional",
          expected_level_score: levels[0].score,
        },
        {
          name: "",
          category: "behavioral",
          expected_level_score: levels[0].score,
        },
      ]);
    }
  }, [levels, roleComps, isEdit]);

  const updateJobDesc = (idx: number, value: string) =>
    setJobDescs((prev) => prev.map((d, i) => (i === idx ? value : d)));
  const addJobDescRow = () => setJobDescs((prev) => [...prev, ""]);
  const removeJobDescRow = (idx: number) =>
    setJobDescs((prev) =>
      prev.length <= 3 ? prev : prev.filter((_, i) => i !== idx)
    );

  const setComp = (idx: number, patch: Partial<CompetencyInput>) =>
    setCompetencies((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );

  const addCompRow = (cat: CatId) => {
    const existingCount = competencies.filter(
      (c) => c.category === cat && (c.competency_id || c.competency_code)
    ).length;
    const newCount = competencies.filter(
      (c) => c.category === cat && !(c.competency_id || c.competency_code)
    ).length;
    const nextIndex = Math.min(
      existingCount + newCount,
      Math.max(0, levels.length - 1)
    );
    const defaultLevel = levels[nextIndex]?.score ?? (levels[0]?.score ?? 1);

    const tempId = `temp-${Date.now()}`;

    setCompetencies((prev) => [
      ...prev,
      {
        name: "",
        category: cat,
        expected_level_score: defaultLevel,
        localTempId: tempId,
      },
    ]);
  };

  const removeCompRow = (idx: number) => {
    setCompetencies((prev) => prev.filter((_, i) => i !== idx));
  };

  const createDepartment = async (name: string, code?: string) => {
    if (!orgId) throw new Error("orgId missing");
    const payload: any = { name };
    if (code) payload.department_code = code;
    const resp = await axios.post(`/organizations/${orgId}/departments`, payload);
    return resp.data as Department;
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) {
      toast({
        title: "Missing name",
        description: "Department name is required.",
        variant: "destructive" as any,
      });
      return;
    }
    setAddingDept(true);
    try {
      const dept = await createDepartment(
        newDeptName.trim(),
        newDeptCode.trim() || undefined
      );
      setLocalDepartments((p) => [dept, ...p]);
      setDeptId(dept.id);
      setAddDeptOpen(false);
      setNewDeptName("");
      setNewDeptCode("");
      toast({ title: "Department added", description: dept.name });
    } catch (err: any) {
      toast({
        title: "Add department failed",
        description:
          err?.response?.data?.detail || err?.message || "Could not add department",
        variant: "destructive" as any,
      });
    } finally {
      setAddingDept(false);
    }
  };

  const onSaveRole = async () => {
    if (!orgId) return;

    const jdClean = jobDescs.map((s) => s.trim()).filter(Boolean);

    if (!title.trim() || !deptId) {
      toast({
        title: "Missing fields",
        description: "Role title and Department are required.",
        variant: "destructive" as any,
      });
      return;
    }

    if (jdClean.length < 3) {
      toast({
        title: "Insufficient descriptions",
        description: "Please provide at least 3 job descriptions.",
        variant: "destructive" as any,
      });
      return;
    }

    if (!levels.length) {
      toast({
        title: "Levels not configured",
        description:
          "Please configure levels for this organization before adding competencies.",
        variant: "destructive" as any,
      });
      return;
    }

    const compClean: CompetencyInput[] = competencies
      .map((c) => ({
        ...c,
        name: (c.name || "").trim(),
        description: (c.description || "").trim() || undefined,
      }))
      .filter((c) => c.name);

    const hasTech = compClean.some((c) => c.category === "technical");
    const hasFunc = compClean.some((c) => c.category === "functional");
    const hasBeh = compClean.some((c) => c.category === "behavioral");

    if (!hasTech || !hasFunc || !hasBeh) {
      toast({
        title: "Missing competencies",
        description:
          "Add at least one competency for Technical, Functional and Behavioral.",
        variant: "destructive" as any,
      });
      return;
    }

    const dupMap = new Map<string, number>();
    for (const c of compClean) {
      const key = `${c.category}::${c.name.trim().toLowerCase()}`;
      dupMap.set(key, (dupMap.get(key) ?? 0) + 1);
    }
    const duplicates = Array.from(dupMap.entries()).filter(([, cnt]) => cnt > 1);
    if (duplicates.length) {
      const names = duplicates.map(([k]) => k.split("::")[1]);
      toast({
        title: "Duplicate skill names",
        description: `Skill names must be unique within a category. Duplicates: ${names.join(
          ", "
        )}`,
        variant: "destructive" as any,
      });
      return;
    }

    let educationValue: string | undefined;
    if (!educationQual) {
      educationValue = undefined;
    } else if (educationQual === "others") {
      const trimmed = educationOtherText.trim();
      educationValue = trimmed || undefined;
    } else {
      educationValue = educationQual;
    }

    setSaving(true);

    try {
      const basePayload = {
        title: title.trim(),
        department_id: deptId,
        experience_years: expYears ? Number(expYears) : undefined,
        job_descriptions: jdClean,
        job_type: jobType || undefined,
        education_qualification: educationValue,
      };

      // pre-create duplicate-role check (friendly client-side guard)
      if (!isEdit) {
        try {
          const rolesResp = await axios.get(`/organizations/${orgId}/roles`, {
            params: { q: title.trim(), limit: 5, page: 1 },
          });
          const existing = (rolesResp?.data?.items ?? []).find(
            (r: any) => String(r.title ?? "").trim().toLowerCase() === title.trim().toLowerCase()
          );
          if (existing) {
            toast({
              title: "Role exists",
              description: `A role with the title "${title.trim()}" already exists.`,
              variant: "destructive" as any,
            });
            setSaving(false);
            return;
          }
        } catch {
          // ignore lookup failures — we'll still attempt create and rely on server errors
        }
      }

      const makeKey = (item: Partial<CompetencyInput>) =>
        item.localTempId ?? `${(item.name || "").trim().toLowerCase()}::${item.category}`;

      let toCreate = compClean.filter((c) => !c.competency_id);

      {
        const seen = new Set<string>();
        const deduped: typeof toCreate = [];
        for (const it of toCreate) {
          const key = `${it.name.trim().toLowerCase()}::${it.category}`;
          if (!seen.has(key)) {
            deduped.push(it);
            seen.add(key);
          }
        }
        toCreate = deduped;
      }

      const createdMap = new Map<string, { id: string; competency_code?: string }>();
      if (toCreate.length) {
        for (const item of toCreate) {
          const key = makeKey(item);
          if (createdMap.has(key)) continue;

          try {
            const payload: any = {
              name: item.name,
              category: item.category,
              scope: "role_based",
            };
            if (item.description) payload.description = item.description;
            if (item.competency_code) payload.competency_code = item.competency_code;

            // corrected: POST /competencys with org_id query
            const createResp = await axios.post(
              `/competencys/competencys`,
              payload,
              { params: { org_id: orgId } }
            );

            const createdId = createResp?.data?.id;
            const createdCode =
              createResp?.data?.competency_code ?? createResp?.data?.code ?? undefined;

            if (!createdId) throw new Error("No id returned from competency create");

            createdMap.set(key, { id: createdId, competency_code: createdCode });
          } catch (createErr) {
            try {
              const lookupResp = await axios.get(`/competencys/competencys`, {
                params: { q: item.name, limit: 5, page: 1, org_id: orgId },
              });
              const found = (lookupResp?.data?.items ?? []).find(
                (it: any) =>
                  it.name?.toLowerCase() === item.name.toLowerCase() &&
                  String(it.category) === String(item.category)
              );
              if (found && found.id) {
                createdMap.set(key, {
                  id: found.id,
                  competency_code: found.competency_code ?? undefined,
                });
                continue;
              }
            } catch {
              // ignore
            }

            toast({
              title: "Failed to create competency",
              description:
                (createErr as any)?.response?.data?.detail ||
                (createErr as any)?.message ||
                `Could not create competency "${item.name}"`,
              variant: "destructive" as any,
            });
            setSaving(false);
            return;
          }
        }
      }

      const resolveCompetencyId = (c: Partial<CompetencyInput>) => {
        if (c.competency_id) return c.competency_id;
        const key = makeKey(c);
        const created = createdMap.get(key);
        return created?.id;
      };

      const buildBulkItems = (arr: typeof compClean) =>
        arr.map((c) => {
          const item: any = {
            expected_level: c.expected_level_score,
            category: c.category,
          };

          const resolvedId = resolveCompetencyId(c);
          if (resolvedId) {
            item.competency_id = resolvedId;
            item.competency_name = c.name;
            if (c.competency_code) item.competency_code = c.competency_code;
            if (c.description) item.description = c.description;
          } else {
            item.competency_name = c.name;
            if (c.competency_code) item.competency_code = c.competency_code;
            if (c.description) item.description = c.description;
          }

          return item;
        });

      if (!isEdit) {
        // create new role (inactive)
        const createPayload = { ...basePayload, is_active: false };
        let roleRes;
        try {
          roleRes = await axios.post(`/organizations/${orgId}/roles`, createPayload);
        } catch (createErr: any) {
          const detail = createErr?.response?.data?.detail || createErr?.message || "";
          // surface unique constraint/409 errors nicely
          if (createErr?.response?.status === 409 || /unique|uq_roles|already exists/i.test(detail)) {
            toast({
              title: "Role already exists",
              description:
                createErr?.response?.data?.detail?.split("\n")?.[0] ??
                `A role with that title already exists.`,
              variant: "destructive" as any,
            });
            setSaving(false);
            return;
          }
          throw createErr;
        }

        const newRoleId: string = roleRes.data.id;
        const bulkItems = buildBulkItems(compClean);

        await axios.post(
          `/organizations/${orgId}/roles/${newRoleId}/competencys/bulk`,
          { items: bulkItems }
        );

        await axios.patch(`/organizations/${orgId}/roles/${newRoleId}`, {
          is_active: true,
        });

        toast({
          title: "Role created",
          description: "Role, descriptions and competencies have been saved.",
        });
        navigate(`/org/${orgId}/organization/roles`);
      } else {
        await axios.patch(`/organizations/${orgId}/roles/${roleId}`, { ...basePayload });

        const bulkItems = buildBulkItems(compClean);

        await axios.post(`/organizations/${orgId}/roles/${roleId}/competencys/bulk`, {
          items: bulkItems,
        });

        toast({
          title: "Role updated",
          description: "Role details and competencies have been updated successfully.",
        });
      }
    } catch (err: any) {
      if (err?.response?.data) {
        const data = err.response.data;
        if (Array.isArray(data.detail)) {
          const msgs = data.detail.map((d: any) => {
            const loc = (d.loc || []).join(" > ");
            return `${loc}: ${d.msg}`;
          });
          toast({
            title: "Save failed (validation)",
            description: msgs.join("; "),
            variant: "destructive" as any,
          });
        } else {
          toast({
            title: "Save failed",
            description: data.detail || data.message || err.message,
            variant: "destructive" as any,
          });
        }
      } else {
        toast({
          title: "Save failed",
          description: err?.message || "Error",
          variant: "destructive" as any,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!orgId || !roleId) return;
    setDeleting(true);
    try {
      await axios.delete(`/organizations/${orgId}/roles/${roleId}`);
      toast({
        title: "Role deleted",
        description: "The role has been deleted successfully.",
      });
      setDeleteOpen(false);
      navigate(`/org/${orgId}/organization/roles`);
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.response?.data?.detail || err?.message || "Error",
        variant: "destructive" as any,
      });
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ m: 2 }}>
        <Typography variant="body2">Loading…</Typography>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ m: 2 }}>
        <Typography variant="body2" color="error">
          {(error as any)?.message || "Failed to load data."}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ m: 1.5, pr: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          {isEdit ? "Edit Role" : "Add Role"}
        </Typography>

        <Stack spacing={2.5}>
          {/* BASIC DETAILS */}
          <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 1, textTransform: "uppercase" }}
            >
              Basic details
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="Role / Job title *"
                fullWidth
                required
                size="small"
                sx={textFieldSx}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              {isEdit && role?.role_code && (
                <TextField
                  label="Role code"
                  fullWidth
                  size="small"
                  sx={textFieldSx}
                  value={role.role_code}
                  InputProps={{
                    readOnly: true,
                  }}
                  disabled
                  helperText="Automatically generated — shown in edit mode only"
                />
              )}

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems="center"
                sx={{ gap: 1 }}
              >
                <TextField
                  select
                  label="Department *"
                  required
                  fullWidth
                  size="small"
                  sx={textFieldSx}
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
                >
                  {localDepartments.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </TextField>

                {!isEdit && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setAddDeptOpen(true)}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    + Add department
                  </Button>
                )}
              </Stack>

              <TextField
                label="Minimum experience (years)"
                type="number"
                inputProps={{ step: "0.1", min: 0 }}
                fullWidth
                size="small"
                sx={textFieldSx}
                value={expYears}
                onChange={(e) => setExpYears(e.target.value)}
              />

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ mt: 0.5 }}
              >
                <TextField
                  select
                  label="Job type"
                  fullWidth
                  size="small"
                  sx={textFieldSx}
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as JobType | "")}
                  SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
                >
                  <MenuItem value="">
                    <em>Not specified</em>
                  </MenuItem>
                  {JOB_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Desired Educational Qualification"
                  fullWidth
                  size="small"
                  sx={textFieldSx}
                  value={educationQual}
                  onChange={(e) =>
                    setEducationQual(e.target.value as EducationQual | "")
                  }
                  SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
                >
                  <MenuItem value="">
                    <em>Not specified</em>
                  </MenuItem>
                  {EDUCATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              {educationQual === "others" && (
                <TextField
                  label="Specify educational qualification"
                  fullWidth
                  size="small"
                  sx={textFieldSx}
                  value={educationOtherText}
                  onChange={(e) => setEducationOtherText(e.target.value)}
                />
              )}
            </Stack>
          </Box>

          {/* JOB DESCRIPTIONS */}
          <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, textTransform: "uppercase" }}
                >
                  Job description
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Minimum 3 descriptions to clearly define responsibilities.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={`${jobDescs.filter((d) => d.trim()).length} filled`}
                />
                <Button size="small" variant="outlined" onClick={addJobDescRow}>
                  + Add description
                </Button>
              </Stack>
            </Stack>
            <Stack spacing={1.1} sx={{ mt: 1 }}>
              {jobDescs.map((val, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    placeholder={`Description ${idx + 1}`}
                    size="small"
                    sx={textFieldSx}
                    value={val}
                    onChange={(e) => updateJobDesc(idx, e.target.value)}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => removeJobDescRow(idx)}
                    sx={{ minWidth: 42 }}
                  >
                    –
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Box>

          {/* COMPETENCIES */}
          <>
            <Box className={cn("glass-card rounded-2xl")} sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" mb={1}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, textTransform: "uppercase" }}
                  >
                    Competencies / Skills
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Minimum 1 skill in each category – Technical, Functional,
                    Behavioral.
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {levels.length === 0 ? (
              <Typography variant="body2" color="error">
                No levels configured. Configure levels first.
              </Typography>
            ) : (
              <>
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
                      label={`${l.name}`}
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

                {CATEGORY_SET.map((cat) => {
                  const allRows = competencies
                    .map((c, idx) => ({ idx, c }))
                    .filter(({ c }) => c.category === cat.id);

                  const existingRows = allRows.filter(
                    ({ c }) => c.competency_id || c.competency_code
                  );
                  const newRows = allRows.filter(
                    ({ c }) => !(c.competency_id || c.competency_code)
                  );

                  return (
                    <Box
                      key={cat.id}
                      className={cn("glass-card rounded-2xl")}
                      sx={{ p: 2.5 }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mb: 1 }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {cat.name}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => addCompRow(cat.id)}
                        >
                          + Add {cat.name} skill
                        </Button>
                      </Stack>

                      {(existingRows.length === 0 && newRows.length === 0) && (
                        <Typography variant="caption" sx={{ color: "text.secondary", mb: 1 }}>
                          No skills yet. Add at least one.
                        </Typography>
                      )}

                      <Stack spacing={1}>

                        {newRows.length > 0 && (
                          <>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="caption" sx={{ color: "text.secondary", mb: 1 }}>
                              New skills
                            </Typography>
                          </>
                        )}

                        {newRows.map(({ idx, c }) => (
                          <Stack key={c.localTempId ?? idx} spacing={1} sx={{ width: "100%" }}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                              <AutocompleteSkill
                                value={c}
                                orgId={orgId}
                                category={cat.id}
                                onChange={(patch) => setComp(idx, patch)}
                              />

                              <Button variant="outlined" sx={{ minWidth: 42 }} onClick={() => removeCompRow(idx)}>–</Button>
                            </Stack>

                            <TextField
                              label="Description"
                              fullWidth
                              size="small"
                              sx={textFieldSx}
                              value={c.description ?? ""}
                              onChange={(e) => {
                                setComp(idx, { description: e.target.value });
                              }}
                              multiline
                              minRows={2}
                              helperText={c.competency_id ? "This is a role-level note." : undefined}
                            />

                            <TextField
                              select
                              label="Expected level *"
                              size="small"
                              sx={textFieldSx}
                              value={c.expected_level_score}
                              onChange={(e) => setComp(idx, { expected_level_score: Number(e.target.value) })}
                              SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
                            >
                              {levels.map((l) => (
                                <MenuItem key={l.id} value={l.score}>
                                  {l.name}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Stack>
                        ))}

                        {existingRows.map(({ idx, c }) => (
                          <Stack
                            key={c.competency_id || c.competency_code || idx}
                            spacing={1}
                            sx={{ width: "100%" }}
                          >
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                              <Chip size="small" label={c.competency_code ? `Code: ${c.competency_code}`: 'new'} />
                              <AutocompleteSkill
                                value={c}
                                orgId={orgId}
                                category={cat.id}
                                onChange={(patch) => setComp(idx, patch)}
                              />
                              <Button variant="outlined" sx={{ minWidth: 42 }} onClick={() => removeCompRow(idx)}>–</Button>
                            </Stack>

                            <TextField
                              label="Description"
                              fullWidth
                              size="small"
                              sx={textFieldSx}
                              value={c.description ?? ""}
                              onChange={(e) => {
                                setComp(idx, { description: e.target.value });
                              }}
                              multiline
                              minRows={2}
                              helperText={
                                c.competency_id
                                  ? "This is a role-level note. Editing does not change the canonical competency — it will be stored for this role."
                                  : undefined
                              }
                            />

                            <TextField
                              select
                              label="Expected level *"
                              size="small"
                              sx={textFieldSx}
                              value={c.expected_level_score}
                              onChange={(e) =>
                                setComp(idx, { expected_level_score: Number(e.target.value) })
                              }
                              SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
                            >
                              {levels.map((l) => (
                                <MenuItem key={l.id} value={l.score}>
                                  {l.name}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Stack>
                        ))}

                        
                      </Stack>
                    </Box>
                  );
                })}
              </>
            )}
          </>

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mt: 1,
              gap: 2,
            }}
          >
            {isEdit && (
              <Button
                variant="outlined"
                color="error"
                sx={{ textTransform: "none", fontWeight: 600 }}
                onClick={() => setDeleteOpen(true)}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete role"}
              </Button>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Button
              variant="contained"
              className="theme-button"
              sx={{
                textTransform: "none",
                fontWeight: 700,
                px: 3,
                py: 1.1,
              }}
              onClick={onSaveRole}
              disabled={saving}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save role"}
            </Button>
          </Box>
        </Stack>
      </Box>

      <Dialog open={addDeptOpen} onClose={() => !addingDept && setAddDeptOpen(false)}>
        <DialogTitle>Add department</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Department name"
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
          />
          <TextField
            label="Department code (optional)"
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            value={newDeptCode}
            onChange={(e) => setNewDeptCode(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDeptOpen(false)} disabled={addingDept}>
            Cancel
          </Button>
          <Button onClick={handleAddDepartment} disabled={addingDept} variant="contained" className="theme-button">
            {addingDept ? "Adding…" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
        <DialogTitle>Delete role</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this role? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteRole} color="error" disabled={deleting}>
            {deleting ? "Deleting…" : "Yes, delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
