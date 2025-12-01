import * as React from "react";
import { Box, Stack, Typography } from "@mui/material";

/** Input: role_competency_matrix from API */
type RolecompetencyCell = {
  role_id: string;
  role_title: string | null;
  competency_id: string;
  competency_name: string | null;
  avg_current: number | null;
  avg_expected: number | null;
  avg_gap: number | null;
};

export default function HeatmapGrid({
  cells,
  maxRoles = 12,
  maxcompetencys = 16,
}: {
  cells: RolecompetencyCell[];
  maxRoles?: number;
  maxcompetencys?: number;
}) {
  // Collect unique roles/competencys in descending importance (by count of cells)
  const rolesMap = new Map<string, { id: string; title: string | null; count: number }>();
  const competencysMap = new Map<string, { id: string; title: string | null; count: number }>();

  for (const c of cells || []) {
    if (!rolesMap.has(c.role_id)) rolesMap.set(c.role_id, { id: c.role_id, title: c.role_title, count: 0 });
    if (!competencysMap.has(c.competency_id)) competencysMap.set(c.competency_id, { id: c.competency_id, title: c.competency_name, count: 0 });
    rolesMap.get(c.role_id)!.count += 1;
    competencysMap.get(c.competency_id)!.count += 1;
  }

  const topRoles = Array.from(rolesMap.values()).sort((a, b) => b.count - a.count).slice(0, maxRoles);
  const topcompetencys = Array.from(competencysMap.values()).sort((a, b) => b.count - a.count).slice(0, maxcompetencys);

  // Build heat matrix [roles x competencys] using avg_gap
  const roleIndex = new Map(topRoles.map((r, i) => [r.id, i]));
  const competencyIndex = new Map(topcompetencys.map((s, i) => [s.id, i]));
  const heatData: (number | null)[][] = Array.from({ length: topRoles.length }, () =>
    Array.from({ length: topcompetencys.length }, () => null)
  );

  for (const c of cells || []) {
    const ri = roleIndex.get(c.role_id);
    const si = competencyIndex.get(c.competency_id);
    if (ri != null && si != null) {
      heatData[ri][si] = typeof c.avg_gap === "number" ? c.avg_gap : null;
    }
  }

  // Color helpers (neg -> mid -> pos)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const hexToRgb = (hex: string) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  };
  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

  const triInterpolate = (neg: string, mid: string, pos: string, t: number) => {
    const [nR, nG, nB] = hexToRgb(neg);
    const [mR, mG, mB] = hexToRgb(mid);
    const [pR, pG, pB] = hexToRgb(pos);
    if (t <= 0.5) {
      const k = t / 0.5;
      return rgbToHex(lerp(nR, mR, k), lerp(nG, mG, k), lerp(nB, mB, k));
    } else {
      const k = (t - 0.5) / 0.5;
      return rgbToHex(lerp(mR, pR, k), lerp(mG, pG, k), lerp(mB, pB, k));
    }
  };

  const heatNeg = "#ef5350";
  const heatMid = "#ffca28";
  const heatPos = "#66bb6a";

  const flatVals = heatData.flat().filter((v): v is number => Number.isFinite(v as number));
  const maxAbs = flatVals.length ? Math.max(...flatVals.map(v => Math.abs(v))) : 1;
  const norm = (v: number) => (v + maxAbs) / (2 * maxAbs);

  if (!topRoles.length || !topcompetencys.length) {
    return <Typography variant="body2" color="text.secondary">No role–competency data available to visualize.</Typography>;
  }

  return (
    <>
      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `200px repeat(${topcompetencys.length}, 80px)`,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            minWidth: 200 + 80 * topcompetencys.length,
          }}
        >
          {/* corner */}
          <Box sx={{ p: 1, bgcolor: "background.paper", borderRight: 1, borderBottom: 1, borderColor: "divider" }} />
          {/* competency headers */}
          {topcompetencys.map((s, si) => (
            <Box key={`h-${si}`}
              sx={{
                p: 1, fontSize: 12, fontWeight: 600, textAlign: "center",
                bgcolor: "background.paper", borderRight: 1, borderBottom: 1, borderColor: "divider",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
              title={String(s.title)}
            >{s.title}</Box>
          ))}

          {/* rows */}
          {topRoles.map((r, ri) => (
            <React.Fragment key={`row-${ri}`}>
              <Box
                sx={{
                  p: 1, fontSize: 12, fontWeight: 600, borderRight: 1, borderBottom: 1, borderColor: "divider",
                  position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
                title={String(r.title)}
              >
                {r.title}
              </Box>

              {topcompetencys.map((s, si) => {
                const v = heatData[ri]?.[si];
                const isNum = Number.isFinite(v as number);
                const color = isNum ? triInterpolate(heatNeg, heatMid, heatPos, norm(v as number)) : "transparent";
                return (
                  <Box
                    key={`c-${ri}-${si}`}
                    sx={{
                      width: 80, height: 40, borderRight: 1, borderBottom: 1, borderColor: "divider",
                      bgcolor: color, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.7)",
                    }}
                    title={isNum ? `${r.title} × ${s.title}: ${Number(v).toFixed(2)} gap` : `${r.title} × ${s.title}: —`}
                  >
                    {isNum ? Number(v).toFixed(2) : "—"}
                  </Box>
                );
              })}
            </React.Fragment>
          ))}
        </Box>

        {/* legend */}
        <Stack direction="row" spacing={2} alignItems="center" mt={2}>
          <Typography variant="caption">Legend:</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 12, bgcolor: heatNeg, borderRadius: 0.5 }} />
            <Typography variant="caption">{(-maxAbs).toFixed(2)}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 12, bgcolor: heatMid, borderRadius: 0.5 }} />
            <Typography variant="caption">0.00</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 12, bgcolor: heatPos, borderRadius: 0.5 }} />
            <Typography variant="caption">{maxAbs.toFixed(2)}</Typography>
          </Stack>
        </Stack>
      </Box>
    </>
  );
}
