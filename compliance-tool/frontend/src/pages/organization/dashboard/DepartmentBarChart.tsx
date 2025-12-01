// src/pages/organization/dashboard/DepartmentBarChart.tsx
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
} from "recharts";
import { getDepartmentAverages } from "./analyticsApi";

/**
 * DepartmentBarChart (striped expected, slimmer bars)
 * - expected uses SVG pattern (striped)
 * - barSize reduced (slimmer bars) and barGap negative to make bars touch
 * - existing UX (legend above, radio toggle, search/sort) preserved
 */

// produce short label (maxLen characters). keep simple truncation preserving start.
function shortLabel(name: string, maxLen = 5) {
  if (!name) return "—";
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "…";
}

// Custom X axis tick that renders truncated label but includes full name in a <title>
function XTick(props: any) {
  const { x, y, payload } = props;
  const full = String(payload.value ?? "");
  const label = shortLabel(full, 5);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        transform="rotate(-45)"
        style={{ fontSize: 11, fill: "var(--mui-palette-text-primary, #333)" }}
      >
        <title>{full}</title>
        {label}
      </text>
    </g>
  );
}

export default function DepartmentBarChart({ orgId }: { orgId: string }) {
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"dept" | "current" | "delta">("dept");
  const [onlyWithValues, setOnlyWithValues] = React.useState<boolean>(true); // radio default ON

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "department-averages", orgId],
    queryFn: () => getDepartmentAverages(orgId),
    enabled: !!orgId,
  });

  const list = React.useMemo(() => {
    const arr = (data || []).filter((r: any) => {
      if (!search) return true;
      return (r.key || "").toLowerCase().includes(search.toLowerCase());
    });
    return arr;
  }, [data, search]);

  const sorted = React.useMemo(() => {
    return [...list].sort((a: any, b: any) => {
      if (sortBy === "dept") return String(a.key || "").localeCompare(String(b.key || ""));
      if (sortBy === "current") return (b.current_avg ?? 0) - (a.current_avg ?? 0);
      const da = (a.expected_avg ?? 0) - (a.current_avg ?? 0);
      const db = (b.expected_avg ?? 0) - (b.current_avg ?? 0);
      return db - da;
    });
  }, [list, sortBy]);

  if (isLoading) return <Skeleton height={220} />;

  // prepare chart data; keep numeric 2 decimals
  let chartData = sorted.map((r: any) => ({
    name: r.key,
    current: Number(((r.current_avg ?? 0) as number).toFixed(2)),
    expected: Number(((r.expected_avg ?? 0) as number).toFixed(2)),
  }));

  // apply "onlyWithValues" filter if enabled
  if (onlyWithValues) {
    chartData = chartData.filter((d) => {
      // consider tiny float noise as zero threshold
      const cur = Number(d.current ?? 0);
      const exp = Number(d.expected ?? 0);
      return Math.abs(cur) > 0.0001 || Math.abs(exp) > 0.0001;
    });
  }

  // Tooltip: show full department name and values
  const tooltipFormatter = (value: number, name: string) => {
    const pretty = name === "current" ? "Current" : "Expected";
    return [`${value}`, pretty];
  };
  const tooltipLabelFormatter = (label: string) => String(label || "");

  // bar appearance: slimmer bars and bars touching
  const BAR_SIZE = 15; // smaller bar thickness
  const BAR_GAP = 1; // negative to make bars touch/overlay closely

  return (
    <Box>
      {/* Legend (color agenda) moved above chart */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 14, height: 14, bgcolor: "#5ca55cff", borderRadius: 0.5 }} />
              <Typography variant="body2">current</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: 1 }}>
              {/* show a little sample of striped expected in legend */}
              <svg width="18" height="14" style={{ display: "inline-block" }}>
                <defs>
                  <pattern id="deptExpectedPatternLegend" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="#f0f0f0" />
                    <path d="M0 0 L0 6" stroke="#5ca55cff" strokeWidth="10" />
                  </pattern>
                </defs>
                <rect x={0} y={0} width={18} height={14} fill="url(#deptExpectedPatternLegend)" rx={2} />
              </svg>
              <Typography variant="body2">expected</Typography>
            </Box>
          </Box>
        </Stack>

        {/* radio toggle on same horizontal line */}
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

      {/* Search + sort below legend */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <TextField
          size="small"
          placeholder="Search department"
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
          <MenuItem value="dept">Sort: Department (A → Z)</MenuItem>
          <MenuItem value="current">Sort: Current (desc)</MenuItem>
          <MenuItem value="delta">Sort: Gap (expected - current desc)</MenuItem>
        </Select>
      </Stack>

      {chartData.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          No departments match filter.
        </Typography>
      ) : (
        <Box sx={{ width: "100%", height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 12, left: 8, bottom: 80 }}
              barGap={BAR_GAP}
            >
              {/* SVG defs for striped expected fill */}
              <defs>
                <pattern id="deptExpectedPattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="#f6faf6" />
                  {/* stripe line color slightly darker */}
                  <path d="M0 0 L0 6" stroke="#5ca55cff" strokeWidth="10" />
                </pattern>
                {/* slightly darker pattern (fallback/alternate) */}
                <pattern id="deptExpectedPatternDark" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="#f0f7f0" />
                  <path d="M0 0 L0 6" stroke="#2a6b2aff" strokeWidth="4" />
                </pattern>
              </defs>

              <XAxis
                dataKey="name"
                interval={0}
                height={80}
                tick={<XTick />}
                minTickGap={8}
              />
              <YAxis />

              <Tooltip formatter={tooltipFormatter} labelFormatter={tooltipLabelFormatter} />

              {/* expected - use striped pattern */}
              <Bar
                dataKey="expected"
                name="expected"
                fill="url(#deptExpectedPattern)"
                barSize={BAR_SIZE}
                radius={[6, 6, 6, 6]}
              />

              {/* current - solid color overlay; placed after expected so it appears above */}
              <Bar dataKey="current" name="current" fill="#5ca55cff" barSize={BAR_SIZE} radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
}
