
import { Paper, Typography } from "@mui/material";

export default function StatCard({
  label,
  value,
  suffix,
  highlight = false,
}: {
  label: string;
  value: number | string | null | undefined;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <Paper
      elevation={highlight ? 3 : 1}
      sx={{
        p: 2,
        borderRadius: 2,
        ...(highlight ? { border: "1px solid", borderColor: "primary.main" } : {}),
      }}
    >
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight={700} sx={{ wordBreak: "break-word" }}>
        {value ?? "—"}{typeof value === "number" && suffix ? suffix : ""}
      </Typography>
    </Paper>
  );
}
