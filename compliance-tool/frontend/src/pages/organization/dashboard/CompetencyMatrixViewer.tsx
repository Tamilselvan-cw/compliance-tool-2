// src/pages/organization/org/CompetencyMatrixViewer.tsx
import * as React from "react";
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper, CircularProgress } from "@mui/material";
import axios from "../../../api/axiosInstance";

type Row = any;

export default function CompetencyMatrixViewer({ orgId, surveyId }: { orgId: string; surveyId?: string }) {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // adjust endpoint path as needed (you used skill-matrix earlier)
        const url = surveyId
          ? `/organizations/${orgId}/surveys/${surveyId}/skill-matrix`
          : `/organizations/${orgId}/skill-matrix`;
        const res = await axios.get(url);
        if (!mounted) return;
        // log for debugging (open console)
        console.log("skill-matrix response:", res.data);
        // try to find rows — many APIs return `items`, `rows`, or `data`
        const payload = res.data || {};
        // flexible extraction
        const candidate =
          payload.rows || payload.items || payload.data || payload.matrix || payload;
        // coerce to array if object with keys
        const arr = Array.isArray(candidate) ? candidate : Object.values(candidate || {});
        setRows(arr);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load matrix");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orgId, surveyId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">Error loading matrix: {error}</Typography>
      </Box>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">No competency matrix rows returned by the API.</Typography>
      </Box>
    );
  }

  // Render a simple table of first 20 rows to verify data
  const columns = Object.keys(rows[0]).slice(0, 8); // limit columns to avoid huge table
  return (
    <Paper elevation={0} sx={{ p: 1 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Competency matrix (sample)
      </Typography>
      <Table size="small" sx={{ tableLayout: "auto" }}>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c} sx={{ fontWeight: 700 }}>
                {c}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.slice(0, 20).map((r: any, idx: number) => (
            <TableRow key={idx}>
              {columns.map((c) => (
                <TableCell key={c + idx} sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {String(r[c] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
