
import { Box, Stack, Typography } from "@mui/material";

/**
 * DonutProgress - circular percentage indicator
 *
 * Props:
 * - value: number (0–100)
 * - caption?: string
 * - size?: number (diameter)
 * - stroke?: number (thickness)
 * - color?: string (progress color)
 * - trackColor?: string (background track color)
 */
export function DonutProgress({
  value,
  caption,
  size = 120,
  stroke = 10,
  color = "#8AE34E",
  trackColor = "rgba(0,0,0,0.1)",
}: {
  value: number;
  caption?: string;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <Box sx={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        {/* background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="transparent"
        />
        {/* progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          fill="transparent"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>

      {/* center content */}
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{ position: "absolute", inset: 0 }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: 22 }}>
          {Math.round(value)}%
        </Typography>
        {caption && (
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
