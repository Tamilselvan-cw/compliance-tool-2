import * as React from "react";
import { Paper, Stack, Typography, Box } from "@mui/material";

export default function ChartCard({
  title,
  height = 240,
  children,
  action,
}: {
  title: string;
  height?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Paper sx={{ p: 2, borderRadius: 2, height, overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {action}
      </Stack>
      <Box sx={{ width: "100%", height: "100%", overflow: "hidden", "& svg": { maxWidth: "100%" } }}>
        {children}
      </Box>
    </Paper>
  );
}
