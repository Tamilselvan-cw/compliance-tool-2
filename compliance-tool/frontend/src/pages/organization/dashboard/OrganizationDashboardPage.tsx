// src/pages/organization/dashboard/OrganizationDashboardPage.tsx
import * as React from "react";
import {
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
  Skeleton,
  Grid,
} from "@mui/material";
import {
  FiMoreHorizontal,
  FiLayers,
  FiUsers,
  FiBriefcase,
  FiZap,
} from "react-icons/fi";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "../../../api/axiosInstance";

import CompetencyMatrixAnalyticsOrgWise from "../org/competency_matrix/CompetencyMatrixAnalyticsOrgWise";
import HierarchyTile from "./HeirarchyTile";
import SkillTrendChart from "./SkillTrend";
import RoleBarChart from "./RoleBarChart";
import DepartmentBarChart from "./DepartmentBarChart";

type DashboardMetrics = {
  counts: { employees: number; departments: number; roles: number; competencys: number };
  competency: { overallScorePct: number; avgcompetencyGap: number; spark: number[] };
  hierarchy: any;
  dictionary: any[];
  jobSpecs: any[];
};

const brandText = "#0b0f19";
const subText = "#2c2f36";
const chipGlassSx = {
  bgcolor: "rgba(255,255,255,0.8)",
  color: brandText,
  border: "1px solid rgba(0,0,0,0.08)",
  backdropFilter: "blur(8px)",
};

async function fetchOrgDashboardData(orgId: string): Promise<DashboardMetrics> {
  const [empRes, deptRes, roleRes, competencyRes, dictRes] = await Promise.all([
    axios.get(`/organizations/${orgId}/employees`, { params: { page: 1, page_size: 1 } }),
    axios.get(`/organizations/${orgId}/departments`, { params: { page: 1, page_size: 1 } }),
    axios.get(`/organizations/${orgId}/roles`, { params: { page: 1, limit: 1 } }),
    // <-- patched: call the root /competencys endpoint and pass org_id as query param
    axios.get(`/competencys/competencys`, { params: { org_id: orgId, page: 1, limit: 200 } }),
    axios.get(`/organizations/${orgId}/competency-dictionary`, { params: { limit: 20 } }),
  ]);

  const employees = empRes.data.total ?? (empRes.data.items?.length || 0);
  const departments = deptRes.data.total ?? (deptRes.data.items?.length || 0);
  const roles = roleRes.data.total ?? (roleRes.data.items?.length || 0);
  const competencys = competencyRes.data.total ?? (competencyRes.data.items?.length || 0);

  const dictionary = (dictRes.data?.items ?? []).map((d: any) => ({
    id: d.competency_id,
    name: d.competency_name,
    category: d.competency_category,
  }));

  const backendMetrics = (competencyRes.data && (competencyRes.data.metrics || competencyRes.data.summary)) ?? null;

  let overallScorePct = 0;
  let avgcompetencyGap = 0;
  let spark: number[] = [];

  if (backendMetrics && typeof backendMetrics.overallScorePct === "number") {
    overallScorePct = Math.round(Math.min(100, backendMetrics.overallScorePct));
    avgcompetencyGap = typeof backendMetrics.avgCompetencyGap === "number" ? backendMetrics.avgCompetencyGap : 0;
    spark = Array.isArray(backendMetrics.spark) ? backendMetrics.spark.slice(0, 7) : [];
  } else {
    const items = Array.isArray(competencyRes.data?.items) ? competencyRes.data.items : [];

    if (items.length) {
      let sumCurrent = 0;
      let sumExpected = 0;
      let gapSum = 0;
      let gapCount = 0;

      for (const it of items) {
        const cur = Number(it.current_avg ?? 0);
        const exp = Number(it.expected_avg ?? 0);
        sumCurrent += cur;
        sumExpected += exp;
        if (!Number.isNaN(exp - cur)) {
          gapSum += (exp - cur);
          gapCount++;
        }
      }

      if (sumExpected > 0) {
        overallScorePct = Math.round(Math.min(100, (sumCurrent / sumExpected) * 100));
      } else {
        const maxScale = 5;
        overallScorePct = Math.round(Math.min(100, (sumCurrent / (items.length * maxScale)) * 100));
      }

      avgcompetencyGap = gapCount ? gapSum / gapCount : 0;

      if (Array.isArray(competencyRes.data?.history) && competencyRes.data.history.length) {
        spark = competencyRes.data.history.slice(-7).map((n: any) => Number(n) || 0);
      } else {
        const sample = items
          .sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0))
          .slice(0, 7)
          .map((it: any) => Number(it.current_avg ?? 0));
        while (sample.length < 7) sample.push(0);
        spark = sample;
      }
    } else {
      overallScorePct = 0;
      avgcompetencyGap = 0;
      spark = Array.from({ length: 7 }, () => 0);
    }
  }

  overallScorePct = Math.round(overallScorePct);
  avgcompetencyGap = Number(Number(avgcompetencyGap).toFixed(2));
  spark = spark.map((n) => Number(Number(n).toFixed(2)));

  return {
    counts: { employees, departments, roles, competencys },
    competency: { overallScorePct, avgcompetencyGap, spark },
    hierarchy: { name: "Org Head", role: "CEO", children: [] },
    dictionary,
    jobSpecs: [],
  };
}

const glassBg = "rgba(255,255,255,0.72)";
const glassBorder = "1px solid rgba(0,0,0,0.08)";
const softShadow = "0 12px 28px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)";

const cardSx = {
  p: 2,
  borderRadius: 1.5,
  bgcolor: glassBg,
  border: glassBorder,
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  boxShadow: softShadow,
};

function WidgetCard(props: {
  title?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  sx?: any;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  role?: string;
  tabIndex?: number;
}) {
  const { title, children, right, sx, onClick, role, tabIndex } = props;
  return (
    <Paper elevation={0} sx={{ ...cardSx, ...(sx || {}), ...(onClick ? { cursor: "pointer" } : {}) }} onClick={onClick} role={role} tabIndex={tabIndex}>
      {(title || right) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          {title ? <Typography sx={{ color: brandText, fontWeight: 700 }}>{title}</Typography> : <span />}
          <FiMoreHorizontal style={{ color: subText, opacity: 0.6, fontSize: 16 }} />
          {right}
        </Stack>
      )}
      {children}
    </Paper>
  );
}

/* ---------------------- EmbeddedMatrix helper (SURVEYS ONLY) ---------------------- */

function EmbeddedMatrix({ orgId }: { orgId?: string }) {
  const [surveyId, setSurveyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orgId) return;
      try {
        // Only query surveys — competency-matrix endpoint is not present on backend
        const res = await axios.get(`/organizations/${orgId}/surveys`, {
          params: { page: 1, limit: 1, order_by: "created_at:desc" },
        });
        const items = res?.data?.items ?? res?.data ?? [];
        if (Array.isArray(items) && items.length) {
          const first = items[0];
          const id = first.survey_id ?? first.id;
          if (id) {
            if (!mounted) return;
            setSurveyId(String(id));
            return;
          }
        }

        if (!mounted) return;
        setSurveyId(null);
      } catch (err) {
        console.debug("surveys fetch failed for EmbeddedMatrix", err);
        if (!mounted) return;
        setSurveyId(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [orgId]);

  // Pass empty string if no surveyId to keep child resilient
  return <CompetencyMatrixAnalyticsOrgWise orgId={orgId} surveyId={surveyId ?? ""} />;
}

/* ---------------------- OrganizationDashboardPage component ---------------------- */

export default function OrganizationDashboardPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["org-dashboard", orgId],
    queryFn: () => fetchOrgDashboardData(orgId as string),
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
    return () => window.removeEventListener("org-soft-reload", handler as EventListener);
  }, [orgId, refetch]);

  const showSkeletons = isLoading && !data;
  const counts = data?.counts ?? { employees: 0, departments: 0, roles: 0, competencys: 0 };

  const formattedDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/ /g, "-");

  return (
    <Box sx={{ p: 2, minHeight: "100vh" }}>
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h5" sx={{ color: brandText, fontWeight: 800, letterSpacing: 0.3 }}>Organization Dashboard</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {isFetching && !showSkeletons && <Typography variant="caption" sx={{ color: subText, mr: 1, opacity: 0.7 }}>Refreshing…</Typography>}
            <Chip label={formattedDate} sx={chipGlassSx} />
          </Stack>
        </Stack>

        {isError && !data && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="error">{(error as any)?.message || "Failed to load dashboard data."}</Typography>
          </Box>
        )}

        {/* Top metrics row */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 2, mb: 3 }}>
          {[
            { key: "departments", label: "Departments", value: counts.departments, icon: FiLayers, tint: "#3b82f6" },
            { key: "roles", label: "Roles", value: counts.roles, icon: FiBriefcase, tint: "#8b5cf6" },
            { key: "employees", label: "People", value: counts.employees, icon: FiUsers, tint: "#06b6d4" },
            { key: "competencys", label: "Competencys", value: counts.competencys, icon: FiZap, tint: "#f59e0b" },
          ].map(({ key, label, value, icon: Icon, tint }) => {
            const isPeople = key === "employees";
            const clickableProps = isPeople
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  onClick: () => { if (!orgId) return; navigate(`/org/${orgId}/organization/employees`); },
                  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!orgId) return; navigate(`/org/${orgId}/organization/employees`); } },
                }
              : {};

            return (
              <WidgetCard key={key} sx={{ p: 2 }} {...clickableProps}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ width: 42, height: 42, borderRadius: "14px", display: "grid", placeItems: "center", background: `${tint}22`, border: "1px solid rgba(255,255,255,0.3)" }}>
                    <Icon size={20} color={tint} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 13, color: subText }}>{label}</Typography>
                    {showSkeletons ? <Skeleton width={30} height={28} /> : <Typography sx={{ fontSize: 22, fontWeight: 800, color: brandText, mt: -0.5 }}>{value}</Typography>}
                  </Box>
                </Stack>
              </WidgetCard>
            );
          })}

          {/* Org Hierarchy tile */}
          <Box>
            <HierarchyTile onClick={() => { if (!orgId) return; navigate(`/org/${orgId}/org-hierarchy`); }} />
          </Box>
        </Box>

        <Grid container spacing={2}>
          {/* Competency Matrix (now uses Surveys only) */}
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
              <Box
                sx={{
                  minHeight: 350,
                  maxHeight: 450,
                  overflowY: "auto",
                  overflowX: "hidden",
                  borderRadius: 2,
                  pr: 1, // avoid scrollbar overlap on content
                }}
              >
                <EmbeddedMatrix orgId={orgId as string} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Skill trends (Avg current vs expected)</Typography>
              <SkillTrendChart orgId={orgId as string} />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Role-wise average (current vs expected)</Typography>
              <RoleBarChart orgId={orgId as string} />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Department-wise average (current vs expected)</Typography>
              <DepartmentBarChart orgId={orgId as string} />
            </Paper>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3, borderColor: "rgba(0,0,0,0.08)" }} />
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ color: brandText, fontSize: 12, opacity: 0.9 }}>{showSkeletons ? "Loading…" : `Total People: ${data?.counts.employees ?? 0}`}</Typography>
        </Stack>
      </Box>
    </Box>
  );
}
