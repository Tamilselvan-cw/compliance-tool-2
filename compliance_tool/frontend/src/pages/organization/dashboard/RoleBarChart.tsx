// src/pages/organization/dashboard/RoleBarChart.tsx
import * as React from "react";
import {
  Box,
  TextField,
  Select,
  MenuItem,
  Stack,
  Typography,
  Skeleton,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import { getRoleAverages } from "./analyticsApi";

/**
 * RoleBarChart — layout matched to DepartmentBarChart:
 * - legend above chart
 * - display radio (only-with-values / show all) on same line
 * - search + sort below legend
 * - short labels with <title> for full name
 * - no grid lines
 * - centered container with maxWidth
 */

// truncate label preserving start; show full on hover via <title>
function shortLabel(name: string, maxLen = 5) {
  if (!name) return "—";
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "…";
}

/** Y-axis tick for horizontal (vertical layout) bars — truncated with full tooltip */
function YTick(props: any) {
  const { x, y, payload } = props;
  const full = String(payload.value ?? "");
  const label = shortLabel(full, 6);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        style={{ fontSize: 12, fill: "var(--mui-palette-text-primary,#333)" }}
      >
        <title>{full}</title>
        {label}
      </text>
    </g>
  );
}

export default function RoleBarChart({ orgId }: { orgId: string }) {
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"role" | "current" | "delta">(
    "role"
  );
  const [onlyWithValues, setOnlyWithValues] = React.useState<boolean>(true); // default ON

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "role-averages", orgId],
    queryFn: () => getRoleAverages(orgId),
    enabled: !!orgId,
  });

  const list = React.useMemo(() => {
    return (data || []).filter((r: any) =>
      !search ? true : (r.key || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const sorted = React.useMemo(() => {
    return [...list].sort((a: any, b: any) => {
      if (sortBy === "role") return String(a.key || "").localeCompare(String(b.key || ""));
      if (sortBy === "current") return (b.current_avg ?? 0) - (a.current_avg ?? 0);
      const da = (a.expected_avg ?? 0) - (a.current_avg ?? 0);
      const db = (b.expected_avg ?? 0) - (b.current_avg ?? 0);
      return db - da;
    });
  }, [list, sortBy]);

  if (isLoading) return <Skeleton height={220} />;

  let chartData = sorted.map((r: any) => ({
    name: r.key,
    current: Number(((r.current_avg ?? 0) as number).toFixed(2)),
    expected: Number(((r.expected_avg ?? 0) as number).toFixed(2)),
  }));

  if (onlyWithValues) {
    chartData = chartData.filter((d) => {
      const cur = Number(d.current ?? 0);
      const exp = Number(d.expected ?? 0);
      return Math.abs(cur) > 0.0001 || Math.abs(exp) > 0.0001;
    });
  }

  const tooltipFormatter = (value: number, name: string) => {
    const pretty = name === "current" ? "Current" : "Expected";
    return [`${value}`, pretty];
  };
  const tooltipLabelFormatter = (label: string) => String(label || "");

  const containerMaxWidth = 880;
  const height = Math.max(220, Math.min(720, chartData.length * 46 + 80));

  return (
    <Box>
      {/* Legend (above) + display radio on same row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 14, height: 14, bgcolor: "#0ea5b3", borderRadius: 0.5 }} />
            <Typography variant="body2">current</Typography>
            <Box sx={{ width: 14, height: 14, bgcolor: "#e6e6e6", borderRadius: 0.5, ml: 2 }} />
            <Typography variant="body2" sx={{ ml: 0.5, color: "text.secondary" }}>
              expected
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ ml: "auto" }}>
          <FormControl component="fieldset" variant="standard">
            <FormLabel component="legend" sx={{ fontSize: 12, color: "text.secondary" }}>
              Display
            </FormLabel>
            <RadioGroup
              row
              value={onlyWithValues ? "with" : "all"}
              onChange={(e) => setOnlyWithValues(e.target.value === "with")}
            >
              <FormControlLabel value="with" control={<Radio size="small" />} label="Only with values" />
              <FormControlLabel value="all" control={<Radio size="small" />} label="Show all" />
            </RadioGroup>
          </FormControl>
        </Box>
      </Box>

      {/* Search + sort (below legend) */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <TextField
          size="small"
          placeholder="Search role"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <Select
          size="small"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="role">Sort: Role (A → Z)</MenuItem>
          <MenuItem value="current">Sort: Current (desc)</MenuItem>
          <MenuItem value="delta">Sort: Gap (expected-current desc)</MenuItem>
        </Select>
      </Stack>

      {/* Centered chart container */}
      <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <Box sx={{ width: "100%", maxWidth: `${containerMaxWidth}px`, mx: "auto", height }}>
          {chartData.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 6 }}>
              No roles match filter.
            </Typography>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 12, right: 10, left: 0, bottom: 12 }}
                barGap={-18}
              >
                {/* X numeric axis */}
                <XAxis type="number" domain={[0, "dataMax + 1"]} />
                {/* Y labels truncated via YTick */}
                <YAxis type="category" dataKey="name" width={110} tick={<YTick />} interval={0} />
                <Tooltip formatter={tooltipFormatter} labelFormatter={tooltipLabelFormatter} />

                {/* expected baseline (grey) */}
                <Bar dataKey="expected" name="expected" fill="#e6e6e6" barSize={18} radius={[6, 6, 6, 6]} />

                {/* current overlay with per-bar color (blue/green) and value labels */}
                <Bar dataKey="current" name="current" barSize={18} radius={[6, 6, 6, 6]}>
                  {chartData.map((entry, idx) => {
                    const cur = Number(entry.current ?? 0);
                    const exp = Number(entry.expected ?? 0);
                    const isAbove = cur > exp;
                    // blue (below/equal) or green (exceeds)
                    const fill = isAbove ? "#34d399" : "#0ea5b3";
                    return <Cell key={`cell-${idx}`} fill={fill} />;
                  })}
                  <LabelList dataKey="current" position="right" formatter={(v: any) => `${v}`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Box>
    </Box>
  );
}
