
import { Box, LinearProgress, Typography } from "@mui/material";

type Props = {
  value: number;          // 0-100
  height?: number;        // default 8
  label?: string;         // optional left label
  minWidth?: number;      // default 120
};

export default function CompactProgress({ value, height = 8, label, minWidth = 120 }: Props) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth }}>
      {label && (
        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
          {label}
        </Typography>
      )}
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={v}
          sx={{
            height,
            borderRadius: 999,
            "& .MuiLinearProgress-bar": { borderRadius: 999 },
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ width: 38, textAlign: "right", fontWeight: 700 }}>
        {v}%
      </Typography>
    </Box>
  );
}
