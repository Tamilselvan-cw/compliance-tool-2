// ----------------------------------------------
// src/pages/organization/surveys/SurveyDashboardTab.tsx

import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import { store, LEVELS } from "./surveysStore";

/** Simple ring chart for percentage display */
function Ring({ value }: { value: number }) {
  const r = 56;
  const C = 2 * Math.PI * r;

  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <svg width="126" height="126">
        <circle
          cx="63"
          cy="63"
          r={r}
          stroke="rgba(255,255,255,.2)"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx="63"
          cy="63"
          r={r}
          stroke="url(#g)"
          strokeWidth="12"
          fill="none"
          strokeDasharray={C}
          strokeDashoffset={(1 - value / 100) * C}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--logo-blue)" />
            <stop offset="100%" stopColor="var(--logo-green)" />
          </linearGradient>
        </defs>
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
        }}
      >
        {Math.round(value)}%
      </Box>
    </Box>
  );
}

export default function SurveyDashboardTab() {
  const { surveyId = "" } = useParams();

  // If your store has a typed Survey, you can import & use it here.
  // For now, treat as flexible shape and guard access.
  const rawSurvey = store.get(surveyId) as any;

  if (!rawSurvey) {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Stack alignItems="center" spacing={1}>
          <CircularProgress size={28} />
          <Typography sx={{ color: "var(--color-text-2)" }}>
            Loading survey data…
          </Typography>
        </Stack>
      </Box>
    );
  }

  const surveyName: string =
    rawSurvey.name || `Survey #${String(surveyId).slice(-6)}`;

  // levelsByUser: { [userId]: { [competencyId]: levelScore } }
  const levelsByUser =
    (rawSurvey.levels as
      | Record<string, Record<string, unknown>>
      | undefined) ?? {};

  const participants = Object.keys(levelsByUser).length;

  // Coverage heuristic: (# finite values) / (participants * expectedcompetencysPerUser)
  const expectedcompetencysPerUser = 5;

  const filledCells = Object.values(levelsByUser).reduce<number>(
    (acc, u) => {
      const obj = (u ?? {}) as Record<string, unknown>;
      const count = Object.values(obj).filter((v) =>
        Number.isFinite(Number(v))
      ).length;
      return acc + count;
    },
    0
  );

  const totalCells = Math.max(1, participants * expectedcompetencysPerUser);
  const coverage = participants
    ? Math.min(100, Math.round((filledCells / totalCells) * 100))
    : 40;

  // Placeholder gaps; wire to real data when ready.
  const gaps = [
    { competency: "React", gap: 1.0 },
    { competency: "TypeScript", gap: 0.5 },
    { competency: "REST/GraphQL", gap: 1.2 },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.5fr .8fr" },
        gap: 2,
      }}
    >
      {/* LEFT: charts & analysis */}
      <Card className="glass rounded-2xl" elevation={0}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 800 }}
            >
              {surveyName}
            </Typography>
            <Chip
              size="small"
              label={`${participants} participant${
                participants === 1 ? "" : "s"
              }`}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
          >
            <Box
              className="glass-card rounded-2xl"
              sx={{
                p: 2,
                display: "grid",
                placeItems: "center",
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: 700 }}
              >
                Overall coverage
              </Typography>
              <Ring value={coverage} />
            </Box>

            <Box
              className="glass-card rounded-2xl"
              sx={{ p: 2, flex: 1 }}
            >
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: 700 }}
              >
                competency gaps (lower is better)
              </Typography>
              <Stack spacing={1.25}>
                {gaps.map((g) => (
                  <Box key={g.competency}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                      >
                        {g.competency}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "var(--color-text-2)",
                        }}
                      >
                        {g.gap.toFixed(2)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, g.gap * 20)}
                      sx={{
                        height: 10,
                        borderRadius: 999,
                        background:
                          "rgba(255,255,255,0.18)",
                        "& .MuiLinearProgress-bar": {
                          background:
                            "linear-gradient(90deg, var(--logo-blue), var(--logo-green))",
                        },
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* RIGHT: legend/meta */}
      <Card className="glass rounded-2xl" elevation={0}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 800, mb: 1 }}
          >
            Levels
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap" }}
          >
            {LEVELS.map((l) => (
              <Chip
                key={l.id}
                size="small"
                label={`${l.name} (${l.score})`}
                sx={{
                  bgcolor: "rgba(255,255,255,0.12)",
                  color: "var(--color-text-2)",
                  border:
                    "1px solid rgba(255,255,255,0.16)",
                }}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
