import { Box, Card, CardContent, Chip, Divider, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import { useParams } from "react-router-dom";

/** In a real app fetch by :surveyId; here we compute from local mock attached to window during navigation if needed */
type LevelDef = { id: string; name: string; score: number };
const LEVELS: LevelDef[] = [
  { id: "L1", name: "L1 – Novice",     score: 1 },
  { id: "L2", name: "L2 – Beginner",   score: 2 },
  { id: "L3", name: "L3 – Proficient", score: 3 },
  { id: "L4", name: "L4 – Advanced",   score: 4 },
  { id: "L5", name: "L5 – Expert",     score: 5 },
];

// tiny helpers for a nice look
function Ring({ value }: { value: number }) {
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <svg width="126" height="126">
        <circle cx="63" cy="63" r="56" stroke="rgba(255,255,255,.2)" strokeWidth="12" fill="none" />
        <circle
          cx="63" cy="63" r="56" stroke="url(#g)" strokeWidth="12" fill="none"
          strokeDasharray={2 * Math.PI * 56} strokeDashoffset={(1 - value / 100) * 2 * Math.PI * 56}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0%"  stopColor="var(--logo-blue)" />
            <stop offset="100%" stopColor="var(--logo-green)" />
          </linearGradient>
        </defs>
      </svg>
      <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800 }}>
        {Math.round(value)}%
      </Box>
    </Box>
  );
}

export default function SurveyDetailsPage() {
  const { surveyId = "unknown" } = useParams();

  // mock numbers – in real app compute from server data
  const createdAt = new Date().toISOString();
  const createdBy = "admin@tool.com";
  const participants = 5;

  // fake gaps per competency
  const gaps = [
    { competency: "React", gap: 1.0 },
    { competency: "TypeScript", gap: 0.5 },
    { competency: "HTML/CSS & A11y", gap: 0.2 },
    { competency: "REST/GraphQL", gap: 1.5 },
    { competency: "SQL", gap: 0.7 },
    { competency: "Testing", gap: 0.8 },
  ];
  const avgCoverage = 72; // percent

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.5fr .8fr" }, gap: 2 }}>
      {/* LEFT: charts & analysis */}
      <Card className="glass rounded-2xl" elevation={0}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Survey #{surveyId.slice(-6)}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={`${participants} participants`} />
              <Chip size="small" label="Active" color="success" variant="outlined" />
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <Box className="glass-card rounded-2xl" sx={{ p: 2, display: "grid", placeItems: "center" }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Overall coverage</Typography>
              <Ring value={avgCoverage} />
            </Box>

            <Box className="glass-card rounded-2xl" sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>competency gaps (lower is better)</Typography>
              <Stack spacing={1.25}>
                {gaps.map((g) => (
                  <Box key={g.competency}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{g.competency}</Typography>
                      <Typography variant="caption" sx={{ color: "var(--color-text-2)" }}>{g.gap.toFixed(2)}</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, g.gap * 20)}
                      sx={{
                        height: 10,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.18)",
                        "& .MuiLinearProgress-bar": {
                          background: "linear-gradient(90deg, var(--logo-blue), var(--logo-green))",
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

      {/* RIGHT: legends + meta + comments */}
      <Stack spacing={2}>
        <Card className="glass rounded-2xl" elevation={0}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Levels</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              {LEVELS.map((l) => (
                <Chip
                  key={l.id}
                  size="small"
                  label={`${l.name} (${l.score})`}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.12)",
                    color: "var(--color-text-2)",
                    border: "1px solid rgba(255,255,255,0.16)",
                  }}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card className="glass rounded-2xl" elevation={0}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>About</Typography>
            <Typography variant="body2"><b>Created by:</b> {createdBy}</Typography>
            <Typography variant="body2"><b>Created at:</b> {new Date(createdAt).toLocaleString()}</Typography>
            <Typography variant="body2"><b>Participants:</b> {participants}</Typography>
          </CardContent>
        </Card>

        <Card className="glass rounded-2xl" elevation={0}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Comments</Typography>
            <TextField
              placeholder="Add a comment…"
              fullWidth
              multiline
              minRows={3}
              sx={{
                "& .MuiOutlinedInput-root": {
                  background: "rgba(255,255,255,0.08)",
                },
              }}
            />
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
