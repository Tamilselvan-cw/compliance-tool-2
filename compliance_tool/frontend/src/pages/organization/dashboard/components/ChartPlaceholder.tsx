
import { Box } from "@mui/material";

export default function ChartPlaceholder({
  h = 320,
  msg = "No data to show",
}: {
  h?: number;
  msg?: string;
}) {
  return (
    <Box
      sx={{
        height: h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.secondary",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.default",
        typography: "caption",
      }}
    >
      {msg}
    </Box>
  );
}
