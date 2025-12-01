
import { Box, Skeleton } from "@mui/material";

export default function PageSkeleton({
  sidebarWidth = 240,
  rows = 3,
}: {
  sidebarWidth?: number;
  rows?: number;
}) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar placeholder */}
      <Box
        sx={{
          width: sidebarWidth,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-bg-2)",
        }}
      >
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" width="60%" />
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={32} sx={{ my: 1, borderRadius: 1 }} />
          ))}
        </Box>
      </Box>

      {/* Content placeholder */}
      <Box sx={{ flex: 1, p: 3 }}>
        <Skeleton variant="text" width="40%" height={30} />
        <Box sx={{ mt: 2 }}>
          {[...Array(rows)].map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={140}
              sx={{ mb: 2, borderRadius: 2 }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
