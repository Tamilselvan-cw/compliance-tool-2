import * as React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Button,
  Divider,
  Alert,
  Paper,
  TextField,
  LinearProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useParams } from "react-router-dom";
import axios from "../../../api/axiosInstance";
import { useSurveyContext } from "./SurveyShell";

/* Types */
type ApiEmployee = {
  id: string;
  name?: string;
  full_name?: string;
  email: string;
  primary_role_id?: string | null;
  primary_role?: { id: string } | string | null;
  org_role_id?: string | null;
  org_role?: { id: string } | string | null;
  role_id?: string | null;
  role?: { id: string } | string | null;
  roles?: Array<{ id: string } | string>;
  role_ids?: string[];
  employee_roles?: Array<{ role_id?: string; role?: { id: string } | string }>;
};

type Person = { id: string; name: string; email: string; role_id: string };
type RoleMini = { id: string; name?: string; title?: string };
type competencyMini = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
};
type LevelOpt = { id: string; name: string; score: number; order?: number };

type LevelMap = Record<string, number | undefined>;
type RemarkMap = Record<string, string>;

type CatId = "technical" | "functional" | "behavioral";
const CATEGORY_ORDER = ["technical", "behavioral", "functional"] as const;
const CATS: CatId[] = ["technical", "functional", "behavioral"];
const MIN_PER_CATEGORY = 3;

const LEVELS_FALLBACK: LevelOpt[] = [
  { id: "L1", name: "Beginner", score: 1, order: 1 },
  { id: "L2", name: "Intermediate", score: 2, order: 2 },
  { id: "L3", name: "Advanced", score: 3, order: 3 },
  { id: "L4", name: "Expert", score: 4, order: 4 },
];

type FilteredResult = {
  list: Person[];
  noRoleMatch: boolean;
};

/* Helpers */
function idOf(x: unknown): string | undefined {
  if (!x) return undefined;
  if (typeof x === "string") return x;
  if (typeof x === "object" && "id" in (x as any)) return (x as any).id;
  return undefined;
}
function firstTruthy<T>(...vals: Array<T | undefined | null>): T | undefined {
  for (const v of vals) if (v != null && v !== "" && v !== false) return v as T;
  return undefined;
}
function pickRoleId(e: ApiEmployee): string {
  const single =
    e.primary_role_id ??
    idOf(e.primary_role) ??
    e.org_role_id ??
    idOf(e.org_role) ??
    e.role_id ??
    idOf(e.role);
  if (single) return single;

  const fromRolesArr = Array.isArray(e.roles) ? idOf(e.roles[0] as any) : undefined;
  const fromRoleIds = Array.isArray(e.role_ids) ? e.role_ids[0] : undefined;
  const fromEmpRoles = Array.isArray(e.employee_roles)
    ? firstTruthy(...e.employee_roles.map((r) => r.role_id ?? idOf(r.role)))
    : undefined;

  return firstTruthy(fromRolesArr, fromRoleIds, fromEmpRoles, "") || "";
}

// normalise FastAPI error payloads etc. into a string
function toErrorMessage(raw: any, fallback: string): string {
  const d = raw ?? fallback;

  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) => x?.msg || x?.detail || JSON.stringify(x))
      .join("; ");
  }
  if (typeof d === "object") {
    return d.msg || d.detail || JSON.stringify(d);
  }
  return String(d);
}

export default function SurveyParticipantsTab() {
  const { orgId = "", surveyId = "" } = useParams();
  const { participantsCache, setParticipantsCache } = useSurveyContext();

  // survey meta
  const [surveyUuid, setSurveyUuid] = React.useState<string | null>(
    participantsCache?.surveyUuid ?? null
  );
  const [surveyRoleIds, setSurveyRoleIds] = React.useState<string[]>(
    participantsCache?.surveyRoleIds ?? []
  );

  const [metaErr, setMetaErr] = React.useState<string | null>(null);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  // bootstrap
  const [employees, setEmployees] = React.useState<Person[]>(
    participantsCache?.employees ?? []
  );
  const [rolesRef, setRolesRef] = React.useState<Record<string, RoleMini>>(
    participantsCache?.rolesRef ?? {}
  );
  const [competencysRef, setcompetencysRef] = React.useState<
    Record<string, competencyMini>
  >(participantsCache?.competencysRef ?? {});
  const [levelOpts, setLevelOpts] = React.useState<LevelOpt[]>(
    participantsCache?.levelOpts ?? LEVELS_FALLBACK
  );

  const [bootLoading, setBootLoading] = React.useState<boolean>(
    !participantsCache?.bootDone
  );
  const [bootErr, setBootErr] = React.useState<string | null>(null);

  // role → expected competencys (preloaded once)
  const roleExpectationsRef = React.useRef<
    Record<string, Array<{ competency_id: string; expected_level: number }>>
  >(participantsCache?.roleExpectations ?? {});

  // employee → full draft state (preloaded once; mutated locally)
  type EmpDraft = {
    levels: LevelMap;
    remarks: RemarkMap;
    baseline: Record<string, number>;
    dirty: Set<string>;
    loaded: boolean;
  };
  const employeeStateRef = React.useRef<Record<string, EmpDraft>>(
    participantsCache?.employeeState ?? {}
  );

  // ---- Overall progress from cache (no extra API) ----
  const [, setOverall] = React.useState({
    filled: participantsCache?.overall?.filled ?? 0,
    total: participantsCache?.overall?.total ?? 0,
    percent: participantsCache?.overall?.percent ?? 0,
  });
  const filteredEmployeesRef = React.useRef<Person[]>(
    participantsCache?.filteredEmployees ?? []
  );

  /* -------- Fetch survey meta (once per survey) -------- */
  React.useEffect(() => {
    let on = true;
    (async () => {
      if (!orgId || !surveyId) return;

      // if already have meta in state or cache, skip
      if (surveyUuid) return;

      try {
        const { data } = await axios.get<{ id: string; role_ids?: string[] }>(
          `/organizations/${orgId}/surveys/${surveyId}`
        );
        if (!on) return;

        const nextUuid = data?.id ?? surveyId;
        const nextRoles = Array.isArray(data?.role_ids) ? data.role_ids : [];

        setSurveyUuid(nextUuid);
        setSurveyRoleIds(nextRoles);
        setParticipantsCache((prev: any) => ({
          ...(prev || {}),
          surveyUuid: nextUuid,
          surveyRoleIds: nextRoles,
        }));
      } catch (e: any) {
        if (!on) return;
        setSurveyUuid(surveyId);
        setSurveyRoleIds([]);

        const msg = e?.response?.data?.detail || e?.message;
        setMetaErr(toErrorMessage(msg, "Failed to load survey meta"));

        setParticipantsCache((prev: any) => ({
          ...(prev || {}),
          surveyUuid: surveyId,
          surveyRoleIds: [],
        }));
      }
    })();
    return () => {
      on = false;
    };
  }, [orgId, surveyId, surveyUuid, setParticipantsCache]);

  const computeOverallCached = React.useCallback(() => {
    const list = filteredEmployeesRef.current;
    const totalExpected = list.reduce((sum, p) => {
      if (!p.role_id) return sum;
      return sum + (roleExpectationsRef.current[p.role_id]?.length ?? 0);
    }, 0);

    const totalFilled = list.reduce((sum, p) => {
      const d = employeeStateRef.current[p.id];
      if (!d) return sum;
      const expected = roleExpectationsRef.current[p.role_id ?? ""] ?? [];
      const filled = expected.filter((e) => d.levels[e.competency_id] != null)
        .length;
      return sum + filled;
    }, 0);

    const percent = totalExpected
      ? Math.round((totalFilled / totalExpected) * 100)
      : 0;

    const nextOverall = { filled: totalFilled, total: totalExpected, percent };
    setOverall(nextOverall);

    // notify shell for top bar progress
    window.dispatchEvent(
      new CustomEvent("survey-progress-overall", {
        detail: nextOverall,
      })
    );

    // IMPORTANT: DO NOT write back to participantsCache here
    // to avoid infinite render loops

    return nextOverall;
  }, []);

  /* -------- Bootstrap employees/roles/competencys/levels + matrices -------- */
  React.useEffect(() => {
    let on = true;

    (async () => {
      if (!orgId) return;

      // 🔹 If we already bootstrapped once, reuse cache
      if (participantsCache?.bootDone) {
        const cached = participantsCache;
        setEmployees(cached.employees ?? []);
        setRolesRef(cached.rolesRef ?? {});
        setcompetencysRef(cached.competencysRef ?? {});
        setLevelOpts(cached.levelOpts ?? LEVELS_FALLBACK);
        roleExpectationsRef.current = cached.roleExpectations ?? {};
        employeeStateRef.current = cached.employeeState ?? {};
        filteredEmployeesRef.current =
          cached.filteredEmployees ?? cached.employees ?? [];
        setBootLoading(false);
        computeOverallCached();
        return;
      }

      setBootLoading(true);
      setBootErr(null);
      try {
        // Employees
        const empRes = await axios.get(`/organizations/${orgId}/employees`, {
          params: { page: 1, limit: 200 },
        });
        const raw: any = empRes.data;
        const empList: ApiEmployee[] = Array.isArray(raw)
          ? raw
          : raw?.items ?? [];

        const [rolesRes, competencysRes, levelsRes] = await Promise.all([
          axios.get<{ items: RoleMini[] }>(`/organizations/${orgId}/roles`, {
            params: { page: 1, limit: 200 },
          }),
          axios.get<{ items: competencyMini[] }>(
            `/organizations/${orgId}/competencys`,
            {
              params: { page: 1, limit: 200 },
            }
          ),
          axios
            .get<{ items: LevelOpt[] }>(`/organizations/${orgId}/levels`, {
              params: { page: 1, limit: 200 },
            })
            .catch(() => ({ data: { items: LEVELS_FALLBACK } })),
        ]);

        if (!on) return;

        const people: Person[] = (empList ?? []).map((e) => ({
          id: e.id,
          name: (e.name ?? e.full_name ?? "").trim(),
          email: e.email,
          role_id: pickRoleId(e),
        }));
        setEmployees(people);

        const rolesItems = rolesRes.data.items || [];
        const rolesMap: Record<string, RoleMini> = Object.fromEntries(
          rolesItems.map((r) => [r.id, r])
        );
        setRolesRef(rolesMap);

        const competencysItems = competencysRes.data.items || [];
        const competencysMap: Record<string, competencyMini> =
          Object.fromEntries(competencysItems.map((s) => [s.id, s]));

        const lvls = (levelsRes.data.items || LEVELS_FALLBACK)
          .slice()
          .sort((a, b) => (a.order ?? a.score) - (b.order ?? b.score));
        setLevelOpts(lvls);

        // ---------- Preload role → competencys ----------
        const roleIdsToLoad = Array.from(
          new Set((rolesRes.data.items || []).map((r) => r.id))
        );
        const allExpectations: Record<
          string,
          Array<{ competency_id: string; expected_level: number }>
        > = {};
        for (const rid of roleIdsToLoad) {
          try {
            const { data } = await axios.get<{ items: Array<any> }>(
              `/organizations/${orgId}/roles/${rid}/competencys`,
              { params: { page: 1, limit: 1000 } }
            );
            allExpectations[rid] = (data?.items ?? []).map((i: any) => ({
              competency_id: i.competency_id ?? i.competency?.id,
              expected_level: i.expected_level ?? i.level ?? 1,
            }));

            // ensure competencysMap has metadata
            for (const it of data?.items ?? []) {
              const sid = it.competency_id ?? it.competency?.id;
              if (!sid) continue;
              const name = it.competency?.name ?? it.competency_name;
              const category = (it.competency?.category ??
                it.category ??
                "technical") as string;
              const description =
                it.competency?.description ?? it.description ?? null;
              if (name && !competencysMap[sid]) {
                competencysMap[sid] = { id: sid, name, category, description };
              }
            }
          } catch {
            allExpectations[rid] = [];
          }
        }
        roleExpectationsRef.current = allExpectations;
        setcompetencysRef(competencysMap);

        // ---------- Preload employee → current selections ----------
        if (surveyUuid) {
          const drafts: Record<string, EmpDraft> = {};
          await Promise.all(
            people.map(async (p) => {
              const d: EmpDraft = {
                levels: {},
                remarks: {},
                baseline: {},
                dirty: new Set(),
                loaded: false,
              };
              try {
                if (p.role_id) {
                  const { data } = await axios.get<{ items: Array<any> }>(
                    `/organizations/${orgId}/employees/${p.id}/roles/${p.role_id}/matrices/${surveyUuid}/competencys`,
                    { params: { page: 1, limit: 1000 } }
                  );
                  for (const it of data?.items ?? []) {
                    const sid = it.competency_id;
                    const chosen = it.level ?? it.current_level ?? 1;
                    const current = Math.max(1, it.current_level ?? 1);
                    d.levels[sid] = chosen;
                    d.baseline[sid] = current;
                    if (it.remark) d.remarks[sid] = it.remark;
                  }
                }
                d.loaded = true;
              } catch {
                d.loaded = true;
              }
              drafts[p.id] = d;
            })
          );
          employeeStateRef.current = drafts;

          // after drafts + expectations are ready, seed overall progress once
          const allow = surveyRoleIds?.length ? new Set(surveyRoleIds) : null;
          const filteredNow = allow
            ? people.filter((p) => p.role_id && allow.has(p.role_id)) || people
            : people;

          filteredEmployeesRef.current = filteredNow;
          computeOverallCached();

          // cache everything
          setParticipantsCache((prev: any) => ({
            ...(prev || {}),
            surveyUuid,
            surveyRoleIds,
            bootDone: true,
            employees: people,
            rolesRef: rolesMap,
            competencysRef: competencysMap,
            levelOpts: lvls,
            roleExpectations: allExpectations,
            employeeState: drafts,
            filteredEmployees: filteredNow,
          }));
        } else {
          // even without surveyUuid we can cache base data
          setParticipantsCache((prev: any) => ({
            ...(prev || {}),
            bootDone: true,
            employees: people,
            rolesRef: rolesMap,
            competencysRef: competencysMap,
            levelOpts: lvls,
            roleExpectations: allExpectations,
            employeeState: employeeStateRef.current,
          }));
        }
      } catch (e: any) {
        if (!on) return;
        setBootErr(
          e?.response?.data?.detail || e?.message || "Failed to load base data"
        );
      } finally {
        if (on) setBootLoading(false);
      }
    })();

    return () => {
      on = false;
    };
  }, [
    orgId,
    surveyUuid,
    surveyRoleIds,
    participantsCache,
    computeOverallCached,
    setParticipantsCache,
  ]);

  // filter employees by survey roles, and detect "no role match" scenario
  const { list: filteredEmployees, noRoleMatch } =
    React.useMemo<FilteredResult>(() => {
      if (!surveyRoleIds?.length) {
        return { list: employees, noRoleMatch: false };
      }
      const allow = new Set(surveyRoleIds);
      const matched = employees.filter((e) => e.role_id && allow.has(e.role_id));
      if (matched.length === 0) {
        // no match -> show all employees but flag it
        return { list: employees, noRoleMatch: true };
      }
      // there ARE matches; just show them, no warning
      return { list: matched, noRoleMatch: false };
    }, [employees, surveyRoleIds]);

  // keep ref in sync for computeOverallCached (also covers later changes)
  React.useEffect(() => {
    filteredEmployeesRef.current = filteredEmployees;
    computeOverallCached();
  }, [filteredEmployees, computeOverallCached]);

  // active participant
  const [activeEmpId, setActiveEmpId] = React.useState<string | null>(null);

  // auto-select first employee on load / when filter changes
  React.useEffect(() => {
    if (!activeEmpId && filteredEmployees.length > 0) {
      setActiveEmpId(filteredEmployees[0].id);
    }
  }, [filteredEmployees, activeEmpId]);

  const active = React.useMemo(
    () => filteredEmployees.find((e) => e.id === activeEmpId) || null,
    [filteredEmployees, activeEmpId]
  );

  // expectations for current role
  const expectations = React.useMemo(
    () =>
      active?.role_id ? roleExpectationsRef.current[active.role_id] ?? [] : [],
    [active?.role_id]
  );

  // current levels/remarks/baseline for this employee
  const [levels, setLevels] = React.useState<LevelMap>({});
  const [remarks, setRemarks] = React.useState<RemarkMap>({});
  const [baselineLevels, setBaselineLevels] = React.useState<
    Record<string, number>
  >({});
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!activeEmpId) return;
    const draft = employeeStateRef.current[activeEmpId];
    if (draft) {
      setLevels({ ...draft.levels });
      setRemarks({ ...draft.remarks });
      setBaselineLevels({ ...draft.baseline });
      setDirty(new Set(draft.dirty));
    } else {
      const empty: EmpDraft = {
        levels: {},
        remarks: {},
        baseline: {},
        dirty: new Set(),
        loaded: true,
      };
      employeeStateRef.current[activeEmpId] = empty;
      setLevels({});
      setRemarks({});
      setBaselineLevels({});
      setDirty(new Set());
    }
  }, [activeEmpId]);

  // Progress (for current participant)
  const expectedcompetencyIds = React.useMemo(
    () => new Set(expectations.map((e) => e.competency_id)),
    [expectations]
  );
  const totalCount = expectedcompetencyIds.size;
  const filledCount = Array.from(expectedcompetencyIds).filter(
    (id) => levels[id] != null
  ).length;
  const progressPct = totalCount
    ? Math.round((filledCount / totalCount) * 100)
    : 0;
  const isComplete = totalCount > 0 && filledCount === totalCount;

  // Broadcast local progress
  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("survey-progress", {
        detail: { percent: progressPct, filled: filledCount, total: totalCount },
      })
    );
  }, [progressPct, filledCount, totalCount]);

  // role readiness (uses preloaded expectations)
  const [, setRolesReady] = React.useState<
    Record<string, { byCat: Record<CatId, number>; ready: boolean }>
  >({});
  React.useEffect(() => {
    const roleIds: string[] =
      (surveyRoleIds?.length ? surveyRoleIds : Object.keys(rolesRef)) || [];
    const readyMap: Record<
      string,
      { byCat: Record<CatId, number>; ready: boolean }
    > = {};
    for (const rid of roleIds) {
      const items = roleExpectationsRef.current[rid] ?? [];
      const byCat: Record<CatId, number> = {
        technical: 0,
        functional: 0,
        behavioral: 0,
      };
      for (const it of items) {
        const cat = (competencysRef[it.competency_id]?.category ?? "technical")
          .toLowerCase() as CatId;
        if (byCat[cat] != null) byCat[cat] += 1;
      }
      readyMap[rid] = {
        byCat,
        ready: CATS.every((c) => byCat[c] >= MIN_PER_CATEGORY),
      };
    }
    setRolesReady(readyMap);
  }, [surveyRoleIds, rolesRef, competencysRef]);

  const roleName = (rid?: string) =>
    rid ? rolesRef[rid]?.name || rolesRef[rid]?.title || "" : "";

  // keep cache hot while editing
  const markDirty = (competencyId: string, next?: number) => {
    setLevels((prev) => {
      const nextLevels =
        prev[competencyId] === next ? prev : { ...prev, [competencyId]: next };
      if (activeEmpId) {
        const draft =
          (employeeStateRef.current[activeEmpId] ||= {
            levels: {},
            remarks: {},
            baseline: {},
            dirty: new Set(),
            loaded: true,
          });
        draft.levels = {
          ...draft.levels,
          [competencyId]: next as number | undefined,
        };
        draft.dirty.add(competencyId);
      }
      return nextLevels;
    });
    setDirty((prev) => {
      const s = new Set(prev);
      s.add(competencyId);
      if (activeEmpId) employeeStateRef.current[activeEmpId]?.dirty.add(competencyId);
      return s;
    });

    setParticipantsCache((prev: any) =>
      prev
        ? { ...prev, employeeState: { ...employeeStateRef.current } }
        : { employeeState: { ...employeeStateRef.current } }
    );
  };

  const onRemarkChange = (competencyId: string, value: string) => {
    setRemarks((prev) => {
      const next =
        prev[competencyId] === value ? prev : { ...prev, [competencyId]: value };
      if (activeEmpId) {
        const draft =
          (employeeStateRef.current[activeEmpId] ||= {
            levels: {},
            remarks: {},
            baseline: {},
            dirty: new Set(),
            loaded: true,
          });
        draft.remarks = { ...draft.remarks, [competencyId]: value };
        draft.dirty.add(competencyId);
      }
      return next;
    });
    setDirty((prev) => {
      const s = new Set(prev);
      s.add(competencyId);
      return s;
    });

    setParticipantsCache((prev: any) =>
      prev
        ? { ...prev, employeeState: { ...employeeStateRef.current } }
        : { employeeState: { ...employeeStateRef.current } }
    );
  };

  // save
  const [saving, setSaving] = React.useState(false);
  const [saveOk, setSaveOk] = React.useState<string | null>(null);

  const onSave = async () => {
    if (!orgId || !surveyUuid || !active?.id || !active?.role_id) return;

    const items = Array.from(dirty)
      .map((competency_id) => {
        const s = competencysRef[competency_id];
        if (!s) return null;

        const selectedLevel =
          levels[competency_id] ?? baselineLevels[competency_id] ?? 1;

        const competency_name = s.name;
        const category = (s.category || "").toLowerCase() as
          | "technical"
          | "functional"
          | "behavioral";
        const current_level = Math.max(1, selectedLevel);
        const level = current_level;
        const remark = remarks[competency_id] || "";

        return {
          competency_name,
          category,
          current_level,
          level,
          remark,
          __sid: competency_id,
        };
      })
      .filter(Boolean) as Array<{
      competency_name: string;
      category: "technical" | "functional" | "behavioral";
      current_level: number;
      level: number;
      remark: string;
      __sid: string;
    }>;

    if (items.length === 0) {
      setSaveOk("Nothing to save.");
      setSaveErr(null);
      return;
    }

    setSaving(true);
    setSaveErr(null);
    setSaveOk(null);
    try {
      await axios.post(
        `/organizations/${orgId}/employees/${active.id}/roles/${active.role_id}/matrices/${surveyUuid}/competencys/bulk`,
        { items: items.map(({ __sid, ...rest }) => rest) }
      );

      setDirty(new Set());
      setBaselineLevels((prev) => {
        const next = { ...prev };
        for (const it of items) next[it.__sid] = it.level;
        return next;
      });

      // mirror to cache
      if (activeEmpId) {
        const draft = employeeStateRef.current[activeEmpId];
        if (draft) {
          for (const it of items) {
            draft.levels[it.__sid] = it.level;
            draft.baseline[it.__sid] = it.level;
            draft.remarks[it.__sid] = it.remark;
            draft.dirty.delete(it.__sid);
          }
        }
      }

      setParticipantsCache((prev: any) =>
        prev
          ? { ...prev, employeeState: { ...employeeStateRef.current } }
          : { employeeState: { ...employeeStateRef.current } }
      );

      setSaveOk("Saved.");
      computeOverallCached();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message;
      setSaveErr(toErrorMessage(msg, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  /* UI */
  if (bootLoading)
    return (
      <Box sx={{ p: 2 }}>
        <CircularProgress size={18} />
      </Box>
    );
  if (bootErr)
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {bootErr}
      </Alert>
    );

  return (
    <Box>
      {/* Page header row with participant & local progress */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Participants
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ color: "var(--color-text-2)" }}>
            {active
              ? `${active.name} · ${roleName(active.role_id)}`
              : "Select a participant"}
          </Typography>
          {active && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={`${filledCount}/${totalCount}`} />
              <Chip
                size="small"
                color={isComplete ? "success" : "warning"}
                label={`${progressPct}%`}
              />
              {dirty.size > 0 && (
                <Chip
                  size="small"
                  color="warning"
                  label={`${dirty.size} unsaved`}
                />
              )}
              <Button
                variant="contained"
                size="small"
                disabled={saving || !surveyUuid}
                onClick={onSave}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </Stack>
          )}
        </Stack>
      </Stack>

      {/* Local completion bar */}
      {active && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress variant="determinate" value={progressPct} />
          <Typography variant="caption" sx={{ color: "var(--color-text-2)" }}>
            {filledCount} / {totalCount} competencys selected
          </Typography>
        </Box>
      )}

      {metaErr && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {metaErr}
        </Alert>
      )}
      <Divider sx={{ mb: 1, opacity: 0.3 }} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {/* Left list */}
        <Paper
          variant="outlined"
          sx={{
            p: 1,
            width: { xs: "100%", md: 320 },
            maxHeight: 520,
            overflow: "auto",
          }}
        >
          <TextField
            size="small"
            placeholder="Search by name or email"
            fullWidth
            onChange={(e) => {
              const q = e.target.value.toLowerCase();
              const match = filteredEmployees.find(
                (p) =>
                  (p.name || "").toLowerCase().includes(q) ||
                  p.email.toLowerCase().includes(q)
              );
              if (match)
                setActiveEmpId((prev) => (prev === match.id ? prev : match.id));
            }}
            sx={{ mb: 1 }}
          />
          {employees.length === 0 && (
            <Alert severity="info" sx={{ mb: 1 }}>
              No employees found in this organization yet.
            </Alert>
          )}
          {employees.length > 0 &&
            surveyRoleIds.length > 0 &&
            noRoleMatch && (
              <Alert severity="info" sx={{ mb: 1 }}>
                No employees matched the survey’s selected roles. Showing all
                employees so you can proceed.
              </Alert>
            )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  selected={p.id === activeEmpId}
                  onClick={() =>
                    setActiveEmpId((prev) => (prev === p.id ? prev : p.id))
                  }
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{p.name || "—"}</TableCell>
                  <TableCell>{roleName(p.role_id) || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* Right: expectations grouped by category */}
        <Box sx={{ flex: 1 }}>
          {active &&
            roleExpectationsRef.current[active.role_id]?.length > 0 && (
              <Stack spacing={1.5}>
                {CATEGORY_ORDER.map((cat) => {
                  const rows =
                    roleExpectationsRef.current[active.role_id]
                      ?.map((e) => ({
                        ...e,
                        competency: competencysRef[e.competency_id],
                      }))
                      .filter(
                        (e) => (e.competency?.category || "other") === cat
                      ) ?? [];

                  if (rows.length === 0) return null;

                  return (
                    <Accordion key={cat} defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {cat[0].toUpperCase() + cat.slice(1)} ·{" "}
                          {rows.length} competencys
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell width="36%">competency</TableCell>
                              <TableCell width="22%">Expected</TableCell>
                              <TableCell width="22%">Selected</TableCell>
                              <TableCell width="20%">Remark</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.map((it) => {
                              const competencyId = it.competency_id;
                              const selected = levels[competencyId];
                              return (
                                <TableRow key={competencyId} hover>
                                  <TableCell>
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      {it.competency?.name}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{ opacity: 0.7 }}
                                    >
                                      {it.competency?.description || ""}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      size="small"
                                      label={`L${it.expected_level}`}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <FormControl size="small" fullWidth>
                                      <Select
                                        size="small"
                                        value={selected ?? ""}
                                        displayEmpty
                                        onChange={(e) =>
                                          markDirty(
                                            competencyId,
                                            e.target.value as
                                              | number
                                              | undefined
                                          )
                                        }
                                        renderValue={(v) => {
                                          if (!v)
                                            return (
                                              <span style={{ opacity: 0.6 }}>
                                                Select level…
                                              </span>
                                            );
                                          const lvl = levelOpts.find(
                                            (l) => l.score === (v as number)
                                          );
                                          return `${lvl?.name ?? "L?"} (${v})`;
                                        }}
                                      >
                                        {levelOpts.map((l) => (
                                          <MenuItem
                                            key={l.id}
                                            value={l.score}
                                          >
                                            {l.name} ({l.score})
                                          </MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  </TableCell>
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      placeholder="Optional"
                                      value={remarks[competencyId] ?? ""}
                                      onChange={(e) =>
                                        onRemarkChange(
                                          competencyId,
                                          e.target.value
                                        )
                                      }
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Stack>
            )}
        </Box>
      </Stack>

      {saveErr && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {saveErr}
        </Alert>
      )}
      {saveOk && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {saveOk}
        </Alert>
      )}
    </Box>
  );
}
