// src/pages/organization/dashboard/SkillTrendChart.tsx
import * as React from "react";
import { Box, TextField, Select, MenuItem, Stack, Typography, Skeleton } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { getSkillTrends } from "./analyticsApi";

type SkillRow = {
  key: string;
  current_avg?: number;
  expected_avg?: number;
  count?: number;
};

function truncateText(s: string | number | undefined, max = 5) {
  if (s === undefined || s === null) return "";
  const str = String(s);
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// Customized X axis tick so full text is preserved in title (hover) while rendering truncated label
const XAxisTick: React.FC<any> = ({ x, y, payload }: any) => {
  const full = payload.value as string;
  const display = truncateText(full, 5);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        transform="rotate(-45)"
        style={{ fontSize: 12 }}
        // title={full} // native hover to see full name
      >
        {display}
      </text>
    </g>
  );
};

// Custom tooltip with black translucent background
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  // payload is an array of the series points for this label
  const currentPoint = payload.find((p: any) => p.dataKey === "current");
  const expectedPoint = payload.find((p: any) => p.dataKey === "expected");
  // find original data for count if present
  const original = (currentPoint && currentPoint.payload) || (expectedPoint && expectedPoint.payload) || {};

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        padding: 10,
        borderRadius: 6,
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div>Current: {currentPoint ? String(currentPoint.value) : "—"}</div>
      <div>Expected: {expectedPoint ? String(expectedPoint.value) : "—"}</div>
      {original.count !== undefined && <div>Count: {original.count}</div>}
    </div>
  );
};

export default function SkillTrendChart({ orgId }: { orgId: string }) {
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"key" | "delta" | "current">("key");
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "skill-trends", orgId],
    queryFn: () => getSkillTrends(orgId),
    enabled: !!orgId,
  });

  // expected incoming shape: [{ key: 'Competency A', current_avg: 3.2, expected_avg: 4.0, count: 12 }, ...]
  const list: SkillRow[] = (data || []).filter((r: any) => {
    if (!search) return true;
    return (r.key || "").toLowerCase().includes(search.toLowerCase());
  });

  const sorted = [...list].sort((a: any, b: any) => {
    if (sortBy === "key") return String(a.key).localeCompare(b.key);
    if (sortBy === "current") return (b.current_avg ?? 0) - (a.current_avg ?? 0);
    // delta = expected - current (descending by gap)
    const deltaB = (b.expected_avg ?? 0) - (b.current_avg ?? 0);
    const deltaA = (a.expected_avg ?? 0) - (a.current_avg ?? 0);
    return deltaB - deltaA;
  });

  if (isLoading) return <Skeleton height={160} />;

  const chartData = sorted.map((s: any) => ({
    name: s.key,
    current: s.current_avg ?? 0,
    expected: s.expected_avg ?? 0,
    count: s.count,
  }));

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <TextField
          size="small"
          placeholder="Search skill"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <Select
          size="small"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="key">Sort: Skill (A → Z)</MenuItem>
          <MenuItem value="current">Sort: Current (desc)</MenuItem>
          <MenuItem value="delta">Sort: Gap (expected-current desc)</MenuItem>
        </Select>
      </Stack>

      {chartData.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          No skills match the filter.
        </Typography>
      ) : (
        <Box sx={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 12, left: 12, bottom: 48 }}>
              {/* Grid removed as requested (no CartesianGrid) */}

              <XAxis
                dataKey="name"
                interval={0}
                height={64}
                tick={<XAxisTick />}
                // keep ticks visible (we truncate inside the tick renderer)
              />

              {/* YAxis tickFormatter to limit numeric text length to 5 (string-based truncation) */}
              <YAxis
                domain={[0, "dataMax + 1"]}
                tickFormatter={(v: any) => {
                  const s = String(v);
                  return s.length > 5 ? s.slice(0, 5) + "…" : s;
                }}
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="current" stroke="#0ea5b3" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="expected" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
}
