// src/pages/organization/org/ArHierarchyPage.tsx
import * as React from "react";
import {
  Box,
  Typography,
  Avatar,
  Stack,
  Paper,
  Collapse,
  IconButton,
  Chip,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import axios from "../../../api/axiosInstance";

/**
 * Org chart component with lines + summary toggle + gap badge.
 * - endpoint: GET /organizations/:orgId/hierarchy -> { root: Employee }
 * - Normalizes API competency shape:
 *    { current_avg, expected_avg, gap_pct }  -> converted to { avg_score (0-100), gap_score (0-100) }
 *    or accepts already-normalized { avg_score, gap_score }.
 *
 * Notes:
 * - Uses MAX_LEVEL = 10 for converting level averages to percents; change if your levels are 1..5.
 */

const MAX_LEVEL = 10; // adjust to 5 if your levels are 1..5

type ApiCompetencyShape =
  | {
      current_avg?: number | null; // average current level (1..10)
      expected_avg?: number | null; // average expected level (1..10)
      gap_pct?: number | null; // percent gap ((expected-current)/expected *100)
      strengths?: string[] | null;
      weaknesses?: string[] | null;
    }
  | {
      avg_score?: number | null; // 0..100
      gap_score?: number | null; // 0..100
      strengths?: string[] | null;
      weaknesses?: string[] | null;
    };

type Employee = {
  id: string;
  name: string;
  email?: string | null;
  job_title?: string | null;
  department?: string | null;
  role?: string | null;
  manager_id?: string | null;
  competency?: ApiCompetencyShape | null;
  reports?: Employee[] | null;
};

/* sample fallback so dev view is helpful when API fails */
const sampleData: Employee = {
  id: "root-1",
  name: "David Power",
  email: "david@contoso.com",
  job_title: "CEO",
  department: "Leadership",
  role: "CEO",
  competency: {
    avg_score: 82,
    gap_score: 6,
    strengths: ["Vision"],
    weaknesses: ["Process"],
  },
  reports: [
    {
      id: "r-1",
      name: "Kayo Miwa",
      job_title: "Head Sales",
      department: "Sales",
      role: "Head Sales",
      competency: { avg_score: 71, gap_score: 5, strengths: ["Client Mgmt"], weaknesses: ["Data"] },
      reports: [
        {
          id: "r-1a",
          name: "Cassandra Dunn",
          job_title: "Sales Lead",
          department: "Sales",
          role: "Lead",
          competency: { avg_score: 69, gap_score: 3, strengths: ["Negotiation"], weaknesses: ["Planning"] },
          reports: [],
        },
      ],
    },
  ],
};

/* ---------- Helpers ---------- */

function normalizeCompetency(api: ApiCompetencyShape | null | undefined) {
  // returns { avg_score: number | null (0-100), gap_score: number | null (0-100), strengths, weaknesses }
  if (!api) return { avg_score: null, gap_score: null, strengths: [], weaknesses: [] };

  // If already normalized (avg_score present) use directly
  const asAny = api as any;
  if (asAny.avg_score != null || asAny.gap_score != null) {
    return {
      avg_score: asAny.avg_score == null ? null : Number(asAny.avg_score),
      gap_score: asAny.gap_score == null ? null : Number(asAny.gap_score),
      strengths: asAny.strengths || [],
      weaknesses: asAny.weaknesses || [],
    };
  }

  // Otherwise use current_avg / expected_avg / gap_pct shape
  const current_avg = (asAny.current_avg == null ? null : Number(asAny.current_avg)) as number | null;
  const expected_avg = (asAny.expected_avg == null ? null : Number(asAny.expected_avg)) as number | null;
  const gap_pct = (asAny.gap_pct == null ? null : Number(asAny.gap_pct)) as number | null;

  // convert level average (1..MAX_LEVEL) -> percentage 0..100
  const avg_score = current_avg == null ? null : (current_avg / MAX_LEVEL) * 100;

  // gap_score preference order:
  // 1) gap_pct from API if present (already percent)
  // 2) compute from expected & current: ((expected - current)/expected)*100
  let gap_score = gap_pct;
  if (gap_score == null && expected_avg != null && current_avg != null && expected_avg !== 0) {
    try {
      gap_score = ((expected_avg - current_avg) / expected_avg) * 100;
    } catch {
      gap_score = null;
    }
  }

  return {
    avg_score: avg_score == null ? null : Number(avg_score),
    gap_score: gap_score == null ? null : Number(gap_score),
    strengths: asAny.strengths || [],
    weaknesses: asAny.weaknesses || [],
  };
}

/* ---------------- UI / Tree ---------------- */

export default function ArHierarchyPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [root, setRoot] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/organizations/${orgId}/hierarchy`);
        if (!mounted) return;

        if (res?.data?.root) {
          // Normalize the whole tree: ensure competency normalized shape keys exist
          const normalizeTree = (node: any): Employee => {
            const nc = normalizeCompetency(node?.competency);
            const newNode: Employee = {
              id: node.id,
              name: node.name,
              email: node.email,
              job_title: node.job_title,
              department: node.department,
              role: node.role,
              manager_id: node.manager_id,
              competency: {
                avg_score: nc.avg_score,
                gap_score: nc.gap_score,
                strengths: nc.strengths,
                weaknesses: nc.weaknesses,
              } as any,
              reports: (node.reports || []).map((r: any) => normalizeTree(r)),
            };
            return newNode;
          };

          setRoot(normalizeTree(res.data.root));
        } else {
          // fallback to sample for debugging
          setRoot(sampleData as Employee);
        }
      } catch (err) {
        console.error("Failed to fetch hierarchy, using fallback:", err);
        setRoot(sampleData as Employee);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orgId]);

  return (
    <Box sx={{ p: 2
     }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Organization Hierarchy
      </Typography>

      <Paper elevation={0} sx={{ p: 2, bgcolor: "transparent" }}>
        {loading && <Typography>Loading...</Typography>}
        {!loading && !root && <Typography>No hierarchy available.</Typography>}

        {!loading && root && (
          <Box
            sx={{
              overflow: "auto",
              width: "100%",
              "& .org-chart-root": {
                display: "flex",
                justifyContent: "center",
                width: "fit-content",
                minWidth: "100%",
                p: 2,
              },
            }}
          >
            <Box className="org-chart-root">
              <TreeNode node={root} navigate={navigate} />
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

/* ---------------- Tree node (recursive) ---------------- */

function TreeNode({
  node,
  navigate,
  depth = 0,
}: {
  node: Employee;
  navigate: ReturnType<typeof useNavigate>;
  depth?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const reports = node.reports ?? [];

  const initials = (node.name || "N A")
    .split(" ")
    .map((n) => (n ? n[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // normalize competency shape (component expects avg_score 0..100 and gap_score %)
  const comp = normalizeCompetency(node.competency as any);
  const avgScore = comp.avg_score;
  const gapScore = comp.gap_score;

  const gapLabel = gapScore == null || Number.isNaN(Number(gapScore)) ? "" : `${Math.round(Number(gapScore))}%`;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        position: "relative",
        minWidth: 180,
        px: 1,
        "@media (max-width:800px)": { minWidth: 140 },
      }}
    >
      <Box
        sx={{
          position: "relative",
          "&::after": reports.length
            ? {
                content: '""',
                position: "absolute",
                left: "50%",
                top: "100%",
                transform: "translateX(-50%)",
                width: 2,
                height: 18,
                bgcolor: "divider",
              }
            : undefined,
        }}
      >
        <Stack alignItems="center" spacing={0.5} sx={{ cursor: "default", p: 1, borderRadius: 1 }}>
          <Box sx={{ position: "relative" }}>
            <Avatar
              onClick={() => navigate(`../employees/${node.id}`)}
              sx={{
                width: 56,
                height: 56,
                bgcolor: avgScore != null ? "primary.light" : "grey.300",
                color: "text.primary",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {initials}
            </Avatar>

            <Chip
              label={gapLabel}
              size="small"
              sx={{
                position: "absolute",
                right: -8,
                bottom: -8,
                bgcolor:
                  gapScore == null ? "grey.400" : gapScore > 15 ? "error.main" : gapScore > 6 ? "warning.main" : "success.main",
                color: "white",
                fontWeight: 700,
                height: 24,
                minWidth: 36,
                px: 0.5,
              }}
            />
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{node.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {node.role ?? node.job_title ?? ""}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <IconButton size="small" onClick={() => setOpen((s) => !s)} aria-label={open ? "Hide summary" : "Show summary"}>
              {open ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 1, minWidth: 220, maxWidth: 320 }}>
          <Paper elevation={1} sx={{ p: 1.25 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{node.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {node.role ?? node.job_title ?? ""} • {node.department ?? ""}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Avg Competency
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{avgScore == null ? "N/A" : `${Number(avgScore).toFixed(0)}%`}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Gap
                </Typography>
                <Typography sx={{ color: gapScore != null && gapScore > 15 ? "error.main" : "text.primary", fontWeight: 700 }}>
                  {gapScore == null ? "N/A" : `${Number(gapScore).toFixed(0)}%`}
                </Typography>
              </Box>
            </Box>

            {comp.strengths && comp.strengths.length > 0 && (
              <Box sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Strengths
                </Typography>
                <Typography variant="body2">{comp.strengths.join(", ")}</Typography>
              </Box>
            )}

            {comp.weaknesses && comp.weaknesses.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Weaknesses
                </Typography>
                <Typography variant="body2" color="error">
                  {comp.weaknesses.join(", ")}
                </Typography>
              </Box>
            )}

            <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
              <IconButton size="small" onClick={() => navigate(`../employees/${node.id}`)}>
                <Typography variant="button" sx={{ fontSize: 12 }}>
                  Open
                </Typography>
              </IconButton>
              <Box sx={{ flex: 1 }} />
            </Box>
          </Paper>
        </Box>
      </Collapse>

      {reports.length > 0 && (
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "flex-start",
            mt: 2,
            pb: 1,
            position: "relative",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: "6%",
              right: "6%",
              height: 2,
              bgcolor: "divider",
            },
          }}
        >
          {reports.map((rpt) => (
            <Box
              key={rpt.id}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: -16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 2,
                  height: 16,
                  bgcolor: "divider",
                },
                minWidth: 160,
              }}
            >
              <TreeNode node={rpt} navigate={navigate} depth={depth + 1} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
